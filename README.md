# LabWala — understand your lab report in English, Urdu and Punjabi

## ▶ Run it (one command)

Needs only **Docker Desktop** (https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/DyneStein/City-Lab-AI-Hackathon.git
cd City-Lab-AI-Hackathon
docker compose up --build
```

Open **http://localhost:3100** → "Continue on this computer" → **Create account** → tap **Scan** → **Sample report**.
First build takes a few minutes. Stop with `Ctrl+C`.

### Optional: switch on AI explanations and Gmail (free keys)

Without keys the app still works fully, using its cited medical reference library.
To turn on GPT-OSS-120B explanations and Gmail import:

1. `cp labwala/.env.example labwala/.env`
2. Open `labwala/.env` and paste:
   - `AI_API_KEY=` a free Groq key from https://console.groq.com/keys
   - `GOOGLE_CLIENT_ID=` / `GOOGLE_CLIENT_SECRET=` (optional, Gmail) — steps are inside the file
3. `docker compose up --build` again.

To use it on a phone on the same Wi-Fi, add `PUBLIC_URL=http://<your-laptop-ip>:3100` to `labwala/.env`
so the laptop's QR code points to the right address.

---


Explains laboratory reports in plain English, Pakistani Urdu and Punjabi (Shahmukhi). It educates; it never diagnoses.
Everything runs on free tools.

```
Bahria-Hackathon/
├── labwala/            Next.js app (UI, API, database, AI layer)
└── privacy-service/   Python sidecar: Microsoft Presidio + Pakistani PII rules
```

## Run it

```bash
# 1. Privacy sidecar (Presidio). Needs uv; installs Python 3.12 automatically.
cd privacy-service && uv sync --python 3.12
uv run --python 3.12 uvicorn app:app --host 127.0.0.1 --port 8790

# 2. App
cd labwala
npm install
cp .env.example .env.local      # add AI_API_KEY (free Groq key) to enable AI explanations
npm run dev                     # http://localhost:3100 (also on your Wi-Fi)
```

Use **"Use a sample report"** on the upload page to try it with the two synthetic reports
(`labwala/public/samples/`, regenerate with `npm run samples`). Never test with someone else's real report.

Checks: `npm test` (parser + safety rules), `npm run typecheck`, `npx next build`.

## How a report flows

```
upload (PDF/JPG/PNG, magic-byte checked, 15 MB max)
  → encrypted at rest (AES-256-GCM)
  → digital PDF: pdf.js text with positions | photo: tesseract.js OCR | scanned PDF: pages rendered in the browser, then OCR
  → deterministic parser: test, value, unit, lab-printed range, flag; unclear rows marked "please check"
  → USER VERIFIES every row (nothing is explained before this)
  → status computed in CODE from the lab's own range: within / outside / needs review / potentially urgent / no range
  → RAG: curated MedlinePlus library + live MedlinePlus Connect (by LOINC, cached)
  → minimized payload (test rows + age band only) → built-in PK rules + Presidio → [PERSON_1]-style placeholders
  → GPT-OSS-120B (any OpenAI-compatible host) → JSON validated with Zod → safety post-checks → restore from encrypted vault
  → full explanation / quick summary / interactive original report / voice
```

**Safety rules enforced in code, not left to the AI:**
- Reference ranges only come from the report. The library contains no ranges.
- The AI never decides high or low; it receives the computed status.
- A result's "talk to a doctor" level can never be lower than its status requires.
- Every result that needs review or is potentially urgent always appears in the summary, whatever the AI writes.
- "Potentially urgent" fires only on the lab's own critical flags (HH, LL, Critical). The clinician-approved threshold table (`src/lib/reports/classify.ts`) is intentionally empty until a clinician signs it off with a source.
- If the AI is off, fails, or returns output that fails validation, the app falls back to the cited library and says so.
- If the privacy sidecar is down, AI calls are **blocked** (`PII_FALLBACK=block`).

## Status

| Area | Status |
|---|---|
| Auth (email + bcrypt, httpOnly hashed-token sessions, rate limits) | **Working** |
| Onboarding, language choice (EN / UR / PA), RTL layout, Nastaliq font | **Working** |
| Dashboard, reports list, health history charts | **Working** |
| Upload, PDF text extraction, image OCR, scanned-PDF OCR | **Working** (tested on synthetic reports) |
| Verification / correction screen | **Working** |
| Interactive original-report viewer (aligned markers, highlight, linked list) | **Working** |
| Full explanation, quick summary, history comparison | **Working.** Library mode works now; the AI mode is built but **untested until an `AI_API_KEY` is added** |
| Follow-up questions | Built; **needs `AI_API_KEY`** |
| Presidio pseudonymization + encrypted vault + restore | **Working** (verified: name, phone, CNIC and MR number masked; test values kept) |
| Voice playback (device voices: pause, resume, stop) | **Working** where the device has a voice; Punjabi falls back to an Urdu voice |
| Data export and account deletion | **Working** |
| Voice input (Whisper on Groq) | Phase 4 |
| Gmail OAuth retrieval, lab directory | Phase 5. Needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (schema ready) |
| Family groups, invitations, consent grants | Phase 6 (schema ready) |
| Doctor / hospital directory | Phase 7 (schema ready; will contain only verified entries) |
| One-time doctor share links | Phase 8 (schema ready: hashed token, expiry, atomic claim) |
| Admin panel | Later phase (role exists) |

## Free stack

Next.js · SQLite + Drizzle · pdf.js · tesseract.js · Presidio + spaCy · GPT-OSS-120B on Groq's free tier
(swap to Cerebras or OpenRouter through env vars) · MedlinePlus Connect · device speech synthesis · Recharts · lucide icons.

## Known limitations

- Urdu and Punjabi UI strings should be reviewed by native speakers; Punjabi (Shahmukhi) especially.
- Presidio's name detection is English-only. Pattern rules (CNIC, phones, record numbers) work in any script, which is why data minimization runs first.
- OCR misreads decimals on photos. That is what the verification screen and the "possible decimal misread" check are for.
- Free-tier AI rate limits vary by provider. Explanations are generated in batches of 6 tests and cached per report and language.
- The SQLite file itself is not encrypted. Uploaded files, layouts, explanations and the PII vault are encrypted per field. For production, use SQLCipher or an encrypted volume.

## Mobile-first: laptop → phone

LabWala is designed for phones. `npm run dev` listens on your Wi-Fi (port 3100). Opening it on a
laptop first shows a **QR code**: scan it with the phone camera and the app opens on the phone,
already signed in (one-time code, hashed in the database, expires in 5 minutes, claimed with an explicit tap).
Choose **"Continue on this computer"** to stay on the laptop; the choice is remembered, and the
phone button in the top bar brings the QR back.

- Phone and laptop must be on the same Wi-Fi (the QR shows the laptop's address, e.g. `http://10.x.x.x:3100`).
- Taking photos works over Wi-Fi: the Scan screen opens the phone's own camera.
- A live in-browser camera viewfinder (needed for automatic page-edge detection) requires HTTPS.
  Free option: `cloudflared tunnel --url http://localhost:3100`, then set `PUBLIC_URL` to the
  `https://….trycloudflare.com` address so the QR uses it. Only do this with synthetic data:
  the tunnel URL is reachable from the internet while it runs.

## Design principles used

- Mobile first: bottom tab bar with a raised Scan button and primary actions in the thumb zone; 48px touch targets.
- Scanner-style capture: dark viewfinder, shutter, page strip, rotate/remove, "make text clearer", multi-page → one PDF.
- Grouping and closure: results grouped by status in rounded containers; the within-range group is collapsed by default.
- Progressive disclosure: summary first, then tap a result for its full explanation in a bottom sheet.
- One language at a time: every string, test name, explanation, error and accessibility label exists in English, Urdu and Punjabi.

## Running everything (3 terminals)

```bash
cd privacy-service && uv run --python 3.12 uvicorn app:app --host 127.0.0.1 --port 8790   # privacy, voice, scanner
cd labwala && npm run dev      # app on http://localhost:3100 (and on your Wi-Fi)
cd labwala && npm run phone    # HTTPS entrance for phones: live camera + edge detection
```

- **Laptop does the heavy work for the phone:** page edge detection and flattening (OpenCV), OCR (tesseract),
  privacy filtering (Presidio) and natural voices all run on the laptop; the phone only captures and displays.
- **Phone camera:** with `npm run phone` the QR opens `https://<laptop-ip>:3443`. The phone warns once
  ("not private") because the certificate is self-made on your laptop — continue, then allow the camera.
  The live viewfinder outlines the page and auto-captures when steady; corners can be adjusted.
  Without it, the Scan button opens the phone camera app instead and detection still runs on the photo.
- **Voices:** Microsoft neural voices through `edge-tts` (Urdu: Asad; Punjabi: Asad reading Shahmukhi;
  English: Prabhat). Free, but synthesis happens on Microsoft's online service, so the explanation text
  (never your name or IDs, which are filtered out first) is sent there. Offline, the device's own voices are used.
  The voice always follows the language picked in the top bar.
- **Gmail (demo):** Profile → Gmail → connect (read-only) → add the sender address your test report will come
  from (e.g. your second email) → send yourself a report PDF from that address → "Check now"
  (the home screen also checks automatically every 10 minutes). Attachments that don't look like lab
  reports are held for you to confirm instead of being imported. Setup steps are in `labwala/.env.example`.
