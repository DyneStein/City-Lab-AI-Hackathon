/**
 * Database schema (SQLite via Drizzle).
 *
 * Conventions
 * - Every primary key is an opaque random id (nanoid), never a CNIC, email or name.
 * - Timestamps are unix milliseconds.
 * - Columns ending in `Enc` hold AES-256-GCM ciphertext produced by `lib/crypto`.
 * - Tables for later phases (family, sharing, gmail, directory) are defined now so the
 *   architecture stays consistent; their features are built in their own phases.
 */
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at").notNull();

/* ───────────────────────── Identity ───────────────────────── */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: createdAt(),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth"), // ISO yyyy-mm-dd, optional if age given
  ageYears: integer("age_years"),
  language: text("language", { enum: ["en", "ur", "pa"] }).notNull().default("en"),
  country: text("country").notNull().default("Pakistan"),
  region: text("region"), // city or general region only
  sex: text("sex", { enum: ["female", "male", "other", "undisclosed"] }).default("undisclosed"),
  phone: text("phone"),
  onboardedAt: integer("onboarded_at"),
  voiceNotifications: integer("voice_notifications", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(), // sha256 of the random session token; raw token only lives in the cookie
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const consents = sqliteTable(
  "consents",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["terms", "ai_processing", "gmail_access", "family_share", "doctor_share", "medical_history_context"],
    }).notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
    scope: text("scope"), // JSON describing what exactly was consented to
    createdAt: createdAt(),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.kind)],
);

/* ───────────────────────── Reports ───────────────────────── */

export const reports = sqliteTable(
  "reports",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["upload", "gmail"] }).notNull(),
    status: text("status", {
      enum: ["uploaded", "needs_ocr", "extracted", "confirmed", "failed"],
    }).notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    fileSha256: text("file_sha256").notNull(), // duplicate detection (per user)
    storageKey: text("storage_key").notNull(), // encrypted blob on disk
    labName: text("lab_name"),
    labId: text("lab_id"),
    reportDate: text("report_date"), // ISO date as printed / confirmed
    extractionMethod: text("extraction_method", { enum: ["pdf_text", "ocr", "manual"] }),
    ocrConfidence: real("ocr_confidence"),
    pageCount: integer("page_count"),
    layoutEnc: text("layout_enc"), // encrypted JSON: positioned text lines per page
    errorCode: text("error_code"),
    createdAt: createdAt(),
    confirmedAt: integer("confirmed_at"),
  },
  (t) => [
    index("reports_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("reports_user_sha_idx").on(t.userId, t.fileSha256),
  ],
);

export const testResults = sqliteTable(
  "test_results",
  {
    id: id(),
    reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    testName: text("test_name").notNull(), // exactly as printed (after user correction)
    canonicalKey: text("canonical_key"), // knowledge-base key, e.g. "hemoglobin"
    valueText: text("value_text").notNull(), // as printed, e.g. "<0.5"
    valueNum: real("value_num"),
    unit: text("unit"),
    refText: text("ref_text"), // range exactly as printed by the lab
    refLow: real("ref_low"),
    refHigh: real("ref_high"),
    labFlag: text("lab_flag"), // H / L / HH / LL / * / Critical as printed
    status: text("status", {
      enum: ["within", "outside", "review", "urgent", "unknown"],
    }).notNull(),
    statusReason: text("status_reason"),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    reviewReason: text("review_reason"),
    userVerified: integer("user_verified", { mode: "boolean" }).notNull().default(false),
    page: integer("page"),
    bbox: text("bbox"), // JSON [x, y, w, h] in page units (top-left origin)
    sourceLine: text("source_line"), // original line text, for audit of extraction
    createdAt: createdAt(),
  },
  (t) => [
    index("results_report_idx").on(t.reportId, t.position),
    index("results_user_key_idx").on(t.userId, t.canonicalKey),
  ],
);

export const explanations = sqliteTable(
  "explanations",
  {
    id: id(),
    reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["full", "summary", "test"] }).notNull(),
    testResultId: text("test_result_id"),
    language: text("language", { enum: ["en", "ur", "pa"] }).notNull(),
    contentEnc: text("content_enc").notNull(), // encrypted validated JSON
    generator: text("generator").notNull(), // "ai:<model>" or "library"
    inputHash: text("input_hash").notNull(), // invalidates cache when results change
    createdAt: createdAt(),
  },
  (t) => [index("expl_lookup_idx").on(t.reportId, t.kind, t.language)],
);

/** Reversible pseudonymization vault (Presidio placeholders -> encrypted originals). */
export const piiVault = sqliteTable(
  "pii_vault",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(), // e.g. "report:<id>" or "chat:<id>"
    placeholder: text("placeholder").notNull(),
    entityType: text("entity_type").notNull(),
    valueEnc: text("value_enc").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vault_scope_ph_idx").on(t.scope, t.placeholder)],
);

export const medicalHistory = sqliteTable("medical_history", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["condition", "medication", "allergy", "family_history", "note"] }).notNull(),
  textEnc: text("text_enc").notNull(),
  createdAt: createdAt(),
});

/* ───────────────────────── Knowledge (RAG) ───────────────────────── */

export const knowledgeSources = sqliteTable("knowledge_sources", {
  id: id(),
  publisher: text("publisher").notNull(), // MedlinePlus, NHS, WHO...
  title: text("title").notNull(),
  url: text("url").notNull(),
  lastReviewed: text("last_reviewed"), // as stated by the publisher, if known
  retrievedAt: integer("retrieved_at").notNull(),
});

export const knowledgeChunks = sqliteTable(
  "knowledge_chunks",
  {
    id: id(),
    sourceId: text("source_id").notNull().references(() => knowledgeSources.id, { onDelete: "cascade" }),
    testKey: text("test_key"), // canonical test key this chunk is about
    loinc: text("loinc"),
    content: text("content").notNull(),
    embedding: text("embedding"), // JSON float array (optional)
  },
  (t) => [index("chunks_key_idx").on(t.testKey)],
);

/* ───────────────────────── Notifications & audit ───────────────────────── */

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "report_ready" etc. Text is rendered from i18n, never PHI
    refId: text("ref_id"),
    readAt: integer("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.createdAt)],
);

/** Audit log. Never stores medical values or raw report text. */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: text("meta"), // small JSON without PHI
    createdAt: createdAt(),
  },
  (t) => [index("audit_actor_idx").on(t.actorId, t.createdAt)],
);

/* ───────────────────────── Phase 5: labs & Gmail ───────────────────────── */

export const labs = sqliteTable("labs", {
  id: id(),
  name: text("name").notNull(),
  verifiedDomains: text("verified_domains").notNull().default("[]"), // JSON string[]
  knownSenders: text("known_senders").notNull().default("[]"),
  reportPatterns: text("report_patterns").notNull().default("[]"), // subject/filename regexes
  formats: text("formats").notNull().default('["pdf"]'),
  apiInfo: text("api_info"),
  verifiedAt: integer("verified_at"), // null = not yet verified by an admin
  createdAt: createdAt(),
});

export const emailConnections = sqliteTable("email_connections", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["gmail"] }).notNull(),
  emailAddress: text("email_address").notNull(),
  scopes: text("scopes").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  selectedLabIds: text("selected_lab_ids").notNull().default("[]"),
  /** Sender addresses the person told us their reports come from (JSON string[]). */
  senders: text("senders").notNull().default("[]"),
  lastSyncAt: integer("last_sync_at"),
  createdAt: createdAt(),
});

/* ───────────────────────── Phase 6: family ───────────────────────── */

export const familyGroups = sqliteTable("family_groups", {
  id: id(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: id(),
    groupId: text("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null for dependents without an account
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "admin", "member", "dependent"] }).notNull(),
    guardianUserId: text("guardian_user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("fm_group_idx").on(t.groupId)],
);

export const familyRelationships = sqliteTable("family_relationships", {
  id: id(),
  groupId: text("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
  fromMemberId: text("from_member_id").notNull(),
  toMemberId: text("to_member_id").notNull(),
  relation: text("relation", { enum: ["parent", "child", "sibling", "spouse", "grandparent", "grandchild", "other"] }).notNull(),
  confirmedByBoth: integer("confirmed_by_both", { mode: "boolean" }).notNull().default(false),
});

export const familyInvitations = sqliteTable("family_invitations", {
  id: id(),
  groupId: text("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
  invitedBy: text("invited_by").notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  acceptedAt: integer("accepted_at"),
  revokedAt: integer("revoked_at"),
  createdAt: createdAt(),
});

/** Explicit, revocable grants. A family relationship alone grants nothing. */
export const accessGrants = sqliteTable(
  "access_grants",
  {
    id: id(),
    ownerId: text("owner_id").notNull(), // whose data
    granteeId: text("grantee_id").notNull(),
    scope: text("scope", { enum: ["summary_only", "flagged_only", "full_reports", "history_context"] }).notNull(),
    reportId: text("report_id"), // null = all reports within scope
    expiresAt: integer("expires_at"),
    revokedAt: integer("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("grants_grantee_idx").on(t.granteeId)],
);

/* ───────────────────────── Phase 7: directory ───────────────────────── */

export const hospitals = sqliteTable("hospitals", {
  id: id(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  specialties: text("specialties").notNull().default("[]"),
  source: text("source").notNull(), // where this was verified
  verifiedAt: integer("verified_at").notNull(),
});

export const doctors = sqliteTable("doctors", {
  id: id(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  hospitalId: text("hospital_id"),
  city: text("city").notNull(),
  phone: text("phone"),
  bookingInfo: text("booking_info"),
  source: text("source").notNull(),
  verifiedAt: integer("verified_at").notNull(),
});

/* ───────────────────────── Phase 8: doctor sharing ───────────────────────── */

export const shareLinks = sqliteTable("share_links", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  doctorEmail: text("doctor_email").notNull(),
  scope: text("scope").notNull(), // JSON: which sections are shared
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  claimedAt: integer("claimed_at"), // set atomically by the explicit claim step
  revokedAt: integer("revoked_at"),
  createdAt: createdAt(),
});

/* ───────────── Desktop → phone handoff (QR sign-in) ───────────── */

/** One-time, short-lived token shown as a QR code on a signed-in computer. Stored hashed. */
export const handoffTokens = sqliteTable("handoff_tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  claimedAt: integer("claimed_at"),
  createdAt: createdAt(),
});

/** Attachments from a watched sender that did not clearly look like a lab report: ask first. */
export const gmailPending = sqliteTable(
  "gmail_pending",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    attachmentId: text("attachment_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sender: text("sender").notNull(),
    receivedAt: integer("received_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pending_msg_att_idx").on(t.userId, t.messageId, t.filename)],
);
