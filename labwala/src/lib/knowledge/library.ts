import { LIBRARY_I18N, type LocalizedEntry } from "./library-i18n";
import type { Lang } from "@/lib/i18n/dictionaries";
/**
 * Curated lab-test reference library.
 *
 * - Plain-language summaries written from the cited public-health sources (MedlinePlus,
 *   U.S. National Library of Medicine). They are general education, not diagnosis.
 * - This library contains NO reference ranges on purpose. Ranges always come from the
 *   lab report itself, because they differ between labs, methods, ages and sexes.
 * - LOINC codes are used to query MedlinePlus Connect for live, cited content.
 * - Used as (1) retrieval context for the AI (RAG) and (2) the fallback explanation when
 *   AI is not configured or fails validation.
 */

export type LibrarySource = { publisher: string; title: string; url: string };

export type LibraryEntry = {
  key: string;
  displayName: string;
  aliases: string[]; // lower-case names/abbreviations as printed by labs
  loinc?: string;
  panel: "blood_count" | "kidney" | "liver" | "sugar" | "lipids" | "thyroid" | "electrolytes" | "vitamins" | "iron" | "other";
  measures: string;
  whenHigh: string;
  whenLow: string;
  reasonsHigh: string[];
  reasonsLow: string[];
  context: string;
  /** Clinician type that commonly reviews this area. Used only as a suggestion, never from one value alone. */
  reviewedBy: string;
  sources: LibrarySource[];
};

const MLP = (title: string, slug: string): LibrarySource => ({
  publisher: "MedlinePlus (U.S. National Library of Medicine)",
  title,
  url: `https://medlineplus.gov/lab-tests/${slug}/`,
});

export const LIBRARY: LibraryEntry[] = [
  {
    key: "hemoglobin",
    displayName: "Hemoglobin",
    aliases: ["hemoglobin", "haemoglobin", "hb", "hgb", "hb%"],
    loinc: "718-7",
    panel: "blood_count",
    measures:
      "Hemoglobin is a protein inside red blood cells that carries oxygen from your lungs to the rest of your body.",
    whenHigh: "A higher value means there is more hemoglobin than this lab usually expects.",
    whenLow:
      "A lower value means there is less hemoglobin than this lab usually expects. Low hemoglobin is often called anemia, but anemia itself has many different causes.",
    reasonsHigh: ["Dehydration", "Smoking", "Living at high altitude", "Some lung or heart conditions"],
    reasonsLow: [
      "Low iron, vitamin B12 or folate",
      "Blood loss, including heavy periods",
      "Pregnancy",
      "Long-term illnesses such as kidney disease",
      "Inherited conditions such as thalassemia trait",
    ],
    context:
      "Ranges differ for women, men, children and during pregnancy. Doctors usually look at hemoglobin together with other blood count values such as MCV and RBC.",
    reviewedBy: "General physician",
    sources: [MLP("Hemoglobin Test", "hemoglobin-test")],
  },
  {
    key: "rbc",
    displayName: "Red blood cell count (RBC)",
    aliases: ["rbc", "rbc count", "red blood cells", "red blood cell count", "total rbc"],
    loinc: "789-8",
    panel: "blood_count",
    measures: "This counts how many red blood cells are in a small amount of your blood. Red blood cells carry oxygen.",
    whenHigh: "More red blood cells than this lab usually expects.",
    whenLow: "Fewer red blood cells than this lab usually expects.",
    reasonsHigh: ["Dehydration", "Smoking", "Some heart or lung conditions"],
    reasonsLow: ["Anemia from different causes", "Blood loss", "Nutritional deficiencies"],
    context: "RBC is read together with hemoglobin, hematocrit and the red cell indices (MCV, MCH, MCHC).",
    reviewedBy: "General physician",
    sources: [MLP("Red Blood Cell (RBC) Count", "red-blood-cell-rbc-count")],
  },
  {
    key: "hematocrit",
    displayName: "Hematocrit (HCT / PCV)",
    aliases: ["hematocrit", "haematocrit", "hct", "pcv", "packed cell volume"],
    loinc: "4544-3",
    panel: "blood_count",
    measures: "Hematocrit is the share of your blood that is made up of red blood cells.",
    whenHigh: "A higher share of red blood cells than this lab usually expects.",
    whenLow: "A lower share of red blood cells than this lab usually expects.",
    reasonsHigh: ["Dehydration", "Smoking", "Some lung or heart conditions"],
    reasonsLow: ["Anemia", "Blood loss", "Pregnancy", "Nutritional deficiencies"],
    context: "Hematocrit usually moves in the same direction as hemoglobin.",
    reviewedBy: "General physician",
    sources: [MLP("Hematocrit Test", "hematocrit-test")],
  },
  {
    key: "mcv",
    displayName: "Mean corpuscular volume (MCV)",
    aliases: ["mcv", "mean corpuscular volume", "mean cell volume"],
    loinc: "787-2",
    panel: "blood_count",
    measures: "MCV is the average size of your red blood cells.",
    whenHigh: "Your red blood cells are, on average, larger than this lab usually expects.",
    whenLow: "Your red blood cells are, on average, smaller than this lab usually expects.",
    reasonsHigh: ["Low vitamin B12 or folate", "Alcohol use", "Some liver or thyroid conditions", "Some medicines"],
    reasonsLow: ["Low iron", "Thalassemia trait", "Long-term inflammation"],
    context: "MCV helps doctors work out what type of anemia might be present, if any.",
    reviewedBy: "General physician",
    sources: [MLP("Complete Blood Count (CBC)", "complete-blood-count-cbc")],
  },
  {
    key: "wbc",
    displayName: "White blood cell count (WBC / TLC)",
    aliases: ["wbc", "wbc count", "white blood cells", "white blood cell count", "tlc", "total leucocyte count", "total leukocyte count", "total wbc"],
    loinc: "6690-2",
    panel: "blood_count",
    measures: "White blood cells are part of your immune system. They help your body fight infections.",
    whenHigh: "More white blood cells than this lab usually expects.",
    whenLow: "Fewer white blood cells than this lab usually expects.",
    reasonsHigh: ["Infection", "Inflammation", "Physical or emotional stress", "Some medicines such as steroids", "Less commonly, blood disorders"],
    reasonsLow: ["Some viral infections", "Some medicines", "Autoimmune conditions", "Less commonly, bone marrow problems"],
    context: "The differential count (neutrophils, lymphocytes and others) gives more detail about which white cells are affected.",
    reviewedBy: "General physician",
    sources: [MLP("White Blood Count (WBC)", "white-blood-count-wbc")],
  },
  {
    key: "platelets",
    displayName: "Platelet count",
    aliases: ["platelets", "platelet count", "plt", "platelet"],
    loinc: "777-3",
    panel: "blood_count",
    measures: "Platelets are small cell fragments that help your blood clot and stop bleeding.",
    whenHigh: "More platelets than this lab usually expects.",
    whenLow: "Fewer platelets than this lab usually expects.",
    reasonsHigh: ["Recent infection or inflammation", "Low iron", "After surgery or blood loss", "Less commonly, bone marrow conditions"],
    reasonsLow: ["Viral infections, including dengue", "Some medicines", "Immune conditions", "Liver disease", "Clumping of the sample in the tube"],
    context:
      "Sometimes platelets clump in the sample tube and the count reads falsely low, so labs may repeat the test. Very low platelets need prompt medical attention.",
    reviewedBy: "General physician",
    sources: [MLP("Platelet Tests", "platelet-tests")],
  },
  {
    key: "glucose_fasting",
    displayName: "Blood glucose (sugar)",
    aliases: ["glucose", "blood glucose", "fasting glucose", "fasting blood sugar", "fbs", "blood sugar fasting", "glucose fasting", "random blood sugar", "rbs", "blood sugar random", "glucose random"],
    loinc: "2345-7",
    panel: "sugar",
    measures: "This measures the amount of sugar (glucose) in your blood at the time the sample was taken.",
    whenHigh: "More sugar in the blood than this lab usually expects for this type of sample.",
    whenLow: "Less sugar in the blood than this lab usually expects.",
    reasonsHigh: ["Not fasting before a fasting test", "Diabetes or prediabetes", "Stress or illness", "Some medicines such as steroids"],
    reasonsLow: ["Long time without food", "Diabetes medicines", "Less commonly, hormone problems"],
    context:
      "Whether you were fasting matters a lot. One reading cannot confirm diabetes; doctors use repeat tests or HbA1c.",
    reviewedBy: "General physician",
    sources: [MLP("Blood Glucose Test", "blood-glucose-test")],
  },
  {
    key: "hba1c",
    displayName: "HbA1c",
    aliases: ["hba1c", "hb a1c", "a1c", "glycated hemoglobin", "glycosylated hemoglobin", "glycated haemoglobin"],
    loinc: "4548-4",
    panel: "sugar",
    measures: "HbA1c shows your average blood sugar level over roughly the past two to three months.",
    whenHigh: "Your average blood sugar over recent months has been higher than this lab's reference range.",
    whenLow: "Lower than this lab's reference range, which is uncommon.",
    reasonsHigh: ["Prediabetes or diabetes", "Some types of anemia can affect the result"],
    reasonsLow: ["Recent blood loss or transfusion", "Some hemoglobin variants"],
    context:
      "Some inherited hemoglobin types and anemias can make HbA1c less reliable. Doctors decide on diabetes using clinical guidelines, not this result alone.",
    reviewedBy: "General physician or endocrinologist",
    sources: [MLP("Hemoglobin A1C (HbA1c) Test", "hemoglobin-a1c-hba1c-test")],
  },
  {
    key: "creatinine",
    displayName: "Creatinine",
    aliases: ["creatinine", "serum creatinine", "s. creatinine", "creat"],
    loinc: "2160-0",
    panel: "kidney",
    measures:
      "Creatinine is a waste product made by your muscles. Your kidneys remove it from your blood, so doctors use it to understand how well the kidneys are filtering.",
    whenHigh: "More creatinine in the blood than this lab usually expects.",
    whenLow: "Less creatinine than this lab usually expects, which is often related to lower muscle mass.",
    reasonsHigh: ["Dehydration", "High muscle mass or intense exercise", "Eating a lot of meat just before the test", "Some medicines", "Reduced kidney function"],
    reasonsLow: ["Lower muscle mass", "Pregnancy", "Older age"],
    context:
      "Doctors often calculate eGFR from creatinine, age and sex. A single result is usually checked again before conclusions are drawn.",
    reviewedBy: "General physician or nephrologist",
    sources: [MLP("Creatinine Test", "creatinine-test")],
  },
  {
    key: "urea",
    displayName: "Urea / Blood urea nitrogen (BUN)",
    aliases: ["urea", "blood urea", "serum urea", "bun", "blood urea nitrogen"],
    loinc: "3094-0",
    panel: "kidney",
    measures: "Urea is a waste product formed when your body breaks down protein. Your kidneys remove it.",
    whenHigh: "More urea than this lab usually expects.",
    whenLow: "Less urea than this lab usually expects.",
    reasonsHigh: ["Dehydration", "High-protein diet", "Bleeding in the stomach or gut", "Reduced kidney function", "Some medicines"],
    reasonsLow: ["Low-protein diet", "Liver conditions", "Pregnancy", "Over-hydration"],
    context: "Some labs report urea and others report BUN; the numbers are on different scales and cannot be compared directly.",
    reviewedBy: "General physician",
    sources: [MLP("BUN (Blood Urea Nitrogen)", "bun-blood-urea-nitrogen")],
  },
  {
    key: "uric_acid",
    displayName: "Uric acid",
    aliases: ["uric acid", "serum uric acid", "s. uric acid"],
    loinc: "3084-1",
    panel: "kidney",
    measures: "Uric acid is a waste product made when your body breaks down substances called purines, found in some foods.",
    whenHigh: "More uric acid than this lab usually expects.",
    whenLow: "Less uric acid than this lab usually expects.",
    reasonsHigh: ["Diet rich in red meat, organ meat or seafood", "Alcohol", "Some medicines such as water pills", "Kidney conditions", "Gout"],
    reasonsLow: ["Some medicines", "Some liver or kidney tubule conditions"],
    context: "A high value does not always cause symptoms, and many people with high uric acid never get gout.",
    reviewedBy: "General physician",
    sources: [MLP("Uric Acid Test", "uric-acid-test")],
  },
  {
    key: "alt",
    displayName: "ALT (SGPT)",
    aliases: ["alt", "sgpt", "alt (sgpt)", "sgpt (alt)", "alanine aminotransferase", "alanine transaminase"],
    loinc: "1742-6",
    panel: "liver",
    measures: "ALT is an enzyme found mostly in the liver. When liver cells are irritated or damaged, more ALT can enter the blood.",
    whenHigh: "More ALT in the blood than this lab usually expects.",
    whenLow: "Low ALT is usually not a concern.",
    reasonsHigh: ["Fatty liver", "Viral hepatitis", "Alcohol", "Some medicines and supplements", "Intense exercise"],
    reasonsLow: [],
    context: "Doctors usually look at ALT together with AST, ALP, bilirubin and albumin.",
    reviewedBy: "General physician or gastroenterologist",
    sources: [MLP("Alanine Transaminase (ALT) Blood Test", "alanine-transaminase-alt-blood-test")],
  },
  {
    key: "ast",
    displayName: "AST (SGOT)",
    aliases: ["ast", "sgot", "ast (sgot)", "sgot (ast)", "aspartate aminotransferase", "aspartate transaminase"],
    loinc: "1920-8",
    panel: "liver",
    measures: "AST is an enzyme found in the liver and also in muscles and the heart.",
    whenHigh: "More AST in the blood than this lab usually expects.",
    whenLow: "Low AST is usually not a concern.",
    reasonsHigh: ["Liver irritation from different causes", "Muscle injury or hard exercise", "Some medicines", "Alcohol"],
    reasonsLow: [],
    context: "Because AST also comes from muscle, it is read alongside ALT and other tests.",
    reviewedBy: "General physician",
    sources: [MLP("Aspartate Aminotransferase (AST) Test", "aspartate-aminotransferase-ast-test")],
  },
  {
    key: "alp",
    displayName: "Alkaline phosphatase (ALP)",
    aliases: ["alp", "alkaline phosphatase", "alk phos", "alk. phosphatase"],
    loinc: "6768-6",
    panel: "liver",
    measures: "ALP is an enzyme found mainly in the liver and bones.",
    whenHigh: "More ALP than this lab usually expects.",
    whenLow: "Less ALP than this lab usually expects.",
    reasonsHigh: ["Normal bone growth in children and teenagers", "Pregnancy", "Liver or bile duct conditions", "Bone conditions"],
    reasonsLow: ["Malnutrition", "Some rare inherited conditions"],
    context: "Higher values are expected in growing children and in pregnancy.",
    reviewedBy: "General physician",
    sources: [MLP("Alkaline Phosphatase", "alkaline-phosphatase")],
  },
  {
    key: "bilirubin_total",
    displayName: "Total bilirubin",
    aliases: ["bilirubin", "total bilirubin", "bilirubin total", "serum bilirubin", "s. bilirubin (total)", "bilirubin (total)"],
    loinc: "1975-2",
    panel: "liver",
    measures: "Bilirubin is a yellow substance made when old red blood cells are broken down. The liver processes it.",
    whenHigh: "More bilirubin than this lab usually expects. Very high levels can cause yellowing of the eyes or skin (jaundice).",
    whenLow: "Low bilirubin is usually not a concern.",
    reasonsHigh: ["Gilbert syndrome (common and usually harmless)", "Liver conditions", "Bile duct blockage", "Faster breakdown of red blood cells", "Fasting"],
    reasonsLow: [],
    context: "Labs may also split bilirubin into direct and indirect parts, which helps doctors find the cause.",
    reviewedBy: "General physician",
    sources: [MLP("Bilirubin Blood Test", "bilirubin-blood-test")],
  },
  {
    key: "albumin",
    displayName: "Albumin",
    aliases: ["albumin", "serum albumin", "s. albumin"],
    loinc: "1751-7",
    panel: "liver",
    measures: "Albumin is a protein made by the liver. It keeps fluid in your blood vessels and carries substances around the body.",
    whenHigh: "More albumin than this lab usually expects, often related to dehydration.",
    whenLow: "Less albumin than this lab usually expects.",
    reasonsHigh: ["Dehydration"],
    reasonsLow: ["Poor nutrition", "Liver conditions", "Kidney conditions that leak protein", "Inflammation or illness"],
    context: "Albumin changes slowly, so it reflects longer-term health more than day-to-day changes.",
    reviewedBy: "General physician",
    sources: [MLP("Albumin Blood Test", "albumin-blood-test")],
  },
  {
    key: "cholesterol_total",
    displayName: "Total cholesterol",
    aliases: ["cholesterol", "total cholesterol", "serum cholesterol", "cholesterol total", "s. cholesterol"],
    loinc: "2093-3",
    panel: "lipids",
    measures: "Cholesterol is a fatty substance in your blood. Your body needs some, but high levels over time can build up in blood vessels.",
    whenHigh: "More cholesterol than this lab's reference value.",
    whenLow: "Less cholesterol than this lab's reference value.",
    reasonsHigh: ["Diet and lifestyle", "Family history", "Underactive thyroid", "Diabetes", "Some medicines"],
    reasonsLow: ["Overactive thyroid", "Poor nutrition", "Cholesterol-lowering medicines"],
    context: "Doctors judge heart risk from the full lipid profile together with age, blood pressure, smoking and diabetes, not total cholesterol alone.",
    reviewedBy: "General physician",
    sources: [MLP("Cholesterol Levels", "cholesterol-levels")],
  },
  {
    key: "ldl",
    displayName: "LDL cholesterol",
    aliases: ["ldl", "ldl cholesterol", "ldl-c", "ldl-cholesterol", "low density lipoprotein"],
    loinc: "13457-7",
    panel: "lipids",
    measures: "LDL is often called 'bad' cholesterol because high levels can build up in the walls of blood vessels.",
    whenHigh: "More LDL than this lab's reference value.",
    whenLow: "Lower LDL, which is usually considered favourable.",
    reasonsHigh: ["Diet high in saturated fat", "Family history", "Low physical activity", "Underactive thyroid"],
    reasonsLow: ["Cholesterol-lowering medicines", "Overactive thyroid"],
    context: "Target LDL levels are set by doctors based on each person's overall heart risk.",
    reviewedBy: "General physician or cardiologist",
    sources: [MLP("Cholesterol Levels", "cholesterol-levels")],
  },
  {
    key: "hdl",
    displayName: "HDL cholesterol",
    aliases: ["hdl", "hdl cholesterol", "hdl-c", "hdl-cholesterol", "high density lipoprotein"],
    loinc: "2085-9",
    panel: "lipids",
    measures: "HDL is often called 'good' cholesterol because it helps carry cholesterol away from blood vessels.",
    whenHigh: "Higher HDL than this lab's reference value, which is usually considered favourable.",
    whenLow: "Lower HDL than this lab's reference value.",
    reasonsHigh: ["Regular exercise", "Genetics"],
    reasonsLow: ["Smoking", "Low physical activity", "Excess weight", "Diabetes"],
    context: "HDL is read alongside LDL, triglycerides and other risk factors.",
    reviewedBy: "General physician",
    sources: [MLP("Cholesterol Levels", "cholesterol-levels")],
  },
  {
    key: "triglycerides",
    displayName: "Triglycerides",
    aliases: ["triglycerides", "triglyceride", "tg", "serum triglycerides", "s. triglycerides"],
    loinc: "2571-8",
    panel: "lipids",
    measures: "Triglycerides are a type of fat in your blood that your body uses for energy.",
    whenHigh: "More triglycerides than this lab's reference value.",
    whenLow: "Lower triglycerides than this lab's reference value.",
    reasonsHigh: ["Not fasting before the test", "Diet high in sugar or refined carbohydrates", "Alcohol", "Diabetes", "Excess weight"],
    reasonsLow: ["Low-fat diet", "Overactive thyroid"],
    context: "Triglycerides rise after meals, so labs often ask for a fasting sample.",
    reviewedBy: "General physician",
    sources: [MLP("Triglycerides Test", "triglycerides-test")],
  },
  {
    key: "tsh",
    displayName: "TSH (thyroid stimulating hormone)",
    aliases: ["tsh", "thyroid stimulating hormone", "s. tsh", "tsh (ultrasensitive)", "ultra sensitive tsh"],
    loinc: "3016-3",
    panel: "thyroid",
    measures: "TSH is a hormone from the pituitary gland in the brain. It tells your thyroid gland how much thyroid hormone to make.",
    whenHigh: "More TSH than this lab usually expects. This can mean the body is asking the thyroid to work harder.",
    whenLow: "Less TSH than this lab usually expects. This can mean the body is sensing plenty of thyroid hormone.",
    reasonsHigh: ["Underactive thyroid", "Recovery from an illness", "Some medicines", "Thyroid medicine dose changes"],
    reasonsLow: ["Overactive thyroid", "Too much thyroid medicine", "Early pregnancy", "Less commonly, pituitary problems"],
    context: "TSH is usually interpreted together with free T4 (and sometimes T3). Ranges can differ in pregnancy.",
    reviewedBy: "General physician or endocrinologist",
    sources: [MLP("TSH (Thyroid-stimulating hormone) Test", "tsh-thyroid-stimulating-hormone-test")],
  },
  {
    key: "sodium",
    displayName: "Sodium",
    aliases: ["sodium", "na", "na+", "serum sodium", "s. sodium"],
    loinc: "2951-2",
    panel: "electrolytes",
    measures: "Sodium is a mineral that helps control the amount of water in your body and helps nerves and muscles work.",
    whenHigh: "More sodium than this lab usually expects.",
    whenLow: "Less sodium than this lab usually expects.",
    reasonsHigh: ["Dehydration", "Not drinking enough water", "Some hormone conditions"],
    reasonsLow: ["Vomiting or diarrhea", "Some medicines such as water pills", "Drinking very large amounts of water", "Heart, kidney or liver conditions"],
    context: "Large or sudden changes in sodium can be serious and need prompt medical review.",
    reviewedBy: "General physician",
    sources: [MLP("Sodium Blood Test", "sodium-blood-test")],
  },
  {
    key: "potassium",
    displayName: "Potassium",
    aliases: ["potassium", "k", "k+", "serum potassium", "s. potassium"],
    loinc: "2823-3",
    panel: "electrolytes",
    measures: "Potassium is a mineral that helps your nerves, muscles and heart work properly.",
    whenHigh: "More potassium than this lab usually expects.",
    whenLow: "Less potassium than this lab usually expects.",
    reasonsHigh: ["Damage to blood cells while the sample was taken (a common lab artifact)", "Kidney conditions", "Some blood pressure medicines"],
    reasonsLow: ["Vomiting or diarrhea", "Water pills", "Some hormone conditions"],
    context: "Potassium affects heart rhythm, so values well outside the range need prompt medical review. Labs sometimes repeat the test to rule out a sample problem.",
    reviewedBy: "General physician",
    sources: [MLP("Potassium Blood Test", "potassium-blood-test")],
  },
  {
    key: "calcium",
    displayName: "Calcium",
    aliases: ["calcium", "ca", "serum calcium", "s. calcium", "total calcium"],
    loinc: "17861-6",
    panel: "electrolytes",
    measures: "Calcium is a mineral needed for strong bones and teeth, and for nerves, muscles and the heart.",
    whenHigh: "More calcium than this lab usually expects.",
    whenLow: "Less calcium than this lab usually expects.",
    reasonsHigh: ["Overactive parathyroid glands", "Too much vitamin D or calcium supplements", "Some other illnesses"],
    reasonsLow: ["Low vitamin D", "Low albumin (which affects the measured value)", "Kidney conditions"],
    context: "Calcium is often interpreted together with albumin, because albumin changes how much calcium is measured.",
    reviewedBy: "General physician",
    sources: [MLP("Calcium Blood Test", "calcium-blood-test")],
  },
  {
    key: "vitamin_d",
    displayName: "Vitamin D (25-OH)",
    aliases: ["vitamin d", "vitamin d3", "25-oh vitamin d", "25 oh vitamin d", "25-hydroxy vitamin d", "vit d", "25(oh)d", "25 (oh) vitamin d", "vitamin d total"],
    loinc: "62292-8",
    panel: "vitamins",
    measures: "This test measures the main form of vitamin D stored in your body. Vitamin D helps keep bones and muscles healthy.",
    whenHigh: "More vitamin D than this lab's reference range, which usually comes from high-dose supplements.",
    whenLow: "Less vitamin D than this lab's reference range. This is common, especially with little sun exposure.",
    reasonsHigh: ["High-dose vitamin D supplements"],
    reasonsLow: ["Little time in sunlight", "Diet low in vitamin D", "Darker skin", "Some digestive or kidney conditions"],
    context: "Labs and guidelines use different cut-offs for 'insufficient' and 'deficient'. Do not start high-dose supplements without advice.",
    reviewedBy: "General physician",
    sources: [MLP("Vitamin D Test", "vitamin-d-test")],
  },
  {
    key: "vitamin_b12",
    displayName: "Vitamin B12",
    aliases: ["vitamin b12", "b12", "vit b12", "cobalamin", "serum b12"],
    loinc: "2132-9",
    panel: "vitamins",
    measures: "Vitamin B12 helps your body make red blood cells and keeps nerves healthy.",
    whenHigh: "More vitamin B12 than this lab usually expects, often from supplements or injections.",
    whenLow: "Less vitamin B12 than this lab usually expects.",
    reasonsHigh: ["Supplements or injections", "Some liver conditions"],
    reasonsLow: ["Vegetarian diet without supplements", "Problems absorbing B12", "Some medicines such as metformin or acid reducers"],
    context: "Low B12 can cause anemia with large red blood cells (high MCV) and nerve symptoms.",
    reviewedBy: "General physician",
    sources: [MLP("Vitamin B Test", "vitamin-b-test")],
  },
  {
    key: "ferritin",
    displayName: "Ferritin",
    aliases: ["ferritin", "serum ferritin", "s. ferritin"],
    loinc: "2276-4",
    panel: "iron",
    measures: "Ferritin is a protein that stores iron. It shows how much iron your body has in reserve.",
    whenHigh: "More ferritin than this lab usually expects.",
    whenLow: "Less ferritin than this lab usually expects, which usually means low iron stores.",
    reasonsHigh: ["Inflammation or infection", "Liver conditions", "Iron overload conditions", "Repeated blood transfusions"],
    reasonsLow: ["Low iron intake", "Blood loss, including heavy periods", "Pregnancy"],
    context: "Ferritin can rise during inflammation even when iron stores are low, so it is read with other iron tests.",
    reviewedBy: "General physician",
    sources: [MLP("Ferritin Blood Test", "ferritin-blood-test")],
  },
  {
    key: "esr",
    displayName: "ESR",
    aliases: ["esr", "erythrocyte sedimentation rate", "sed rate"],
    loinc: "4537-7",
    panel: "other",
    measures: "ESR measures how quickly red blood cells settle in a tube. It is a general sign of inflammation in the body.",
    whenHigh: "Red blood cells settled faster than this lab usually expects, which can happen when there is inflammation.",
    whenLow: "Low ESR is usually not a concern.",
    reasonsHigh: ["Infection", "Inflammatory conditions", "Anemia", "Pregnancy", "Older age"],
    reasonsLow: [],
    context: "ESR is not specific: it shows that inflammation may be present but not where or why.",
    reviewedBy: "General physician",
    sources: [MLP("Erythrocyte Sedimentation Rate (ESR)", "erythrocyte-sedimentation-rate-esr")],
  },
];

/* ── Lookup ── */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%+()\-. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const aliasIndex = new Map<string, LibraryEntry>();
for (const e of LIBRARY) for (const a of e.aliases) aliasIndex.set(norm(a), e);

/** Match a printed test name to a library entry, or null. Deterministic, no AI. */
export function matchTest(printedName: string): LibraryEntry | null {
  const n = norm(printedName);
  if (aliasIndex.has(n)) return aliasIndex.get(n)!;
  const stripped = n.replace(/^(serum|s\.|plasma|blood)\s+/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
  if (aliasIndex.has(stripped)) return aliasIndex.get(stripped)!;
  // longest alias contained as a whole word
  let best: LibraryEntry | null = null;
  let bestLen = 0;
  for (const [alias, e] of aliasIndex) {
    if (alias.length < 3 || alias.length <= bestLen) continue;
    const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (re.test(n)) {
      best = e;
      bestLen = alias.length;
    }
  }
  return best;
}

export const getEntry = (key: string | null | undefined) => (key ? LIBRARY.find((e) => e.key === key) ?? null : null);

/** Words the PII detector must never redact (test names are not personal data). */
export const MEDICAL_ALLOW_LIST = Array.from(
  new Set(LIBRARY.flatMap((e) => [e.displayName, ...e.aliases])),
);

/* ── Localization: the user's language only, never a mix ── */


export function localizedEntry(key: string | null | undefined, lang: Lang): LocalizedEntry | null {
  const e = getEntry(key);
  if (!e) return null;
  const tr = lang === "en" ? null : LIBRARY_I18N[lang]?.[e.key];
  return (
    tr ?? {
      name: e.displayName,
      measures: e.measures,
      whenHigh: e.whenHigh,
      whenLow: e.whenLow,
      reasonsHigh: e.reasonsHigh,
      reasonsLow: e.reasonsLow,
      context: e.context,
    }
  );
}

/** Name shown to the user: localized when the test is known, otherwise as printed by the lab. */
export function testDisplayName(canonicalKey: string | null | undefined, printedName: string, lang: Lang) {
  return localizedEntry(canonicalKey, lang)?.name ?? printedName;
}
