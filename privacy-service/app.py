"""
Nuskha privacy sidecar: Microsoft Presidio (MIT) + Pakistan-specific recognizers.

Runs locally on 127.0.0.1 only. It returns entity *positions*; the Next.js app does the
replacement and keeps the encrypted placeholder vault, so originals never leave the app.

Endpoints
  GET  /health
  POST /analyze   {text, language="en", allow_list=[]}  -> {findings: [{type,start,end,score}]}

Limitations (be honest): NER is English-only (spaCy en_core_web_sm). Pattern recognizers
(CNIC, phones, record numbers) work on any script, but names written in Urdu/Shahmukhi
script are not reliably detected. The app therefore also minimizes data before calling.
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider

nlp = NlpEngineProvider(
    nlp_configuration={"nlp_engine_name": "spacy", "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}]}
).create_engine()

registry = RecognizerRegistry()
registry.load_predefined_recognizers(languages=["en"], nlp_engine=nlp)

registry.add_recognizer(
    PatternRecognizer(
        supported_entity="PK_CNIC",
        patterns=[Pattern("cnic_dashed", r"\b\d{5}-\d{7}-\d\b", 0.95), Pattern("cnic_plain", r"\b\d{13}\b", 0.5)],
        context=["cnic", "nic", "identity", "id card", "شناختی"],
    )
)
registry.add_recognizer(
    PatternRecognizer(
        supported_entity="PHONE_NUMBER",
        name="PkMobileRecognizer",
        patterns=[Pattern("pk_mobile", r"(?:\+92|0092|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b", 0.9)],
    )
)
registry.add_recognizer(
    PatternRecognizer(
        supported_entity="MEDICAL_RECORD_ID",
        patterns=[
            Pattern(
                "record_no",
                r"\b(?:MR|MRN|Reg|Lab|Patient|Case|Visit|Sample)\s*(?:No|#|ID)?\.?\s*[:\-]?\s*[A-Z0-9][A-Z0-9\-/]{3,}\b",
                0.85,
            )
        ],
    )
)

analyzer = AnalyzerEngine(registry=registry, nlp_engine=nlp, supported_languages=["en"])

ENTITIES = [
    "PERSON",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "PK_CNIC",
    "MEDICAL_RECORD_ID",
    "LOCATION",
    "IP_ADDRESS",
    "URL",
    "CREDIT_CARD",
    "IBAN_CODE",
]

app = FastAPI(title="nuskha-privacy", docs_url=None, redoc_url=None)


class AnalyzeIn(BaseModel):
    text: str = Field(max_length=200_000)
    language: str = "en"
    allow_list: list[str] = []


@app.get("/health")
def health():
    return {"ok": True, "engine": "presidio", "languages": ["en"]}


@app.post("/analyze")
def analyze(body: AnalyzeIn):
    results = analyzer.analyze(
        text=body.text,
        language="en",
        entities=ENTITIES,
        allow_list=body.allow_list or None,
        score_threshold=0.4,
    )
    return {"findings": [{"type": r.entity_type, "start": r.start, "end": r.end, "score": round(r.score, 2)} for r in results]}


# ───────────────────────── Voice: Microsoft neural voices via edge-tts ─────────────────────────
# edge-tts runs here but synthesis happens on Microsoft's online read-aloud service (free, needs
# internet). The Next.js app only sends explanation text, after removing personal identifiers.

import asyncio
import io
import json

import cv2
import edge_tts
import numpy as np
from fastapi import HTTPException, Request
from fastapi.responses import Response

ALLOWED_VOICES = {
    "ur-PK-AsadNeural",
    "ur-PK-UzmaNeural",
    "en-IN-PrabhatNeural",
    "en-IN-NeerjaNeural",
    "en-US-AndrewNeural",
}


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    voice: str = "ur-PK-AsadNeural"
    rate: str = "-5%"


@app.post("/tts")
async def tts(body: TtsIn):
    if body.voice not in ALLOWED_VOICES:
        raise HTTPException(400, "voice not allowed")
    # The free read-aloud service drops requests now and then: retry a few times.
    last = "unknown"
    for attempt in range(5):
        buf = io.BytesIO()
        try:
            async for chunk in edge_tts.Communicate(body.text, body.voice, rate=body.rate).stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            if buf.tell() > 0:
                return Response(buf.getvalue(), media_type="audio/mpeg")
            last = "empty"
        except Exception as e:  # network down, service hiccup
            last = type(e).__name__
        await asyncio.sleep(0.35 * (attempt + 1))
    raise HTTPException(502, f"tts unavailable: {last}")


# ───────────────────────── Document scanning: edge detection + flattening (OpenCV) ─────────────────────────

MAX_BYTES = 15 * 1024 * 1024


def _decode(raw: bytes) -> np.ndarray:
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(415, "not an image")
    return img


def _order(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = pts.reshape(4, 2).astype("float32")
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype="float32")


def _find_page(img: np.ndarray):
    """Return (corners in original pixels, confidence 0..1) or (None, 0)."""
    h, w = img.shape[:2]
    scale = 600.0 / max(h, w)
    small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    area_total = small.shape[0] * small.shape[1]
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    # Paper is bright and unsaturated: use both brightness edges and a "whiteness" mask.
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, (0, 0, 120), (180, 70, 255))
    candidates = []
    for src in (gray, white):
        blur = cv2.GaussianBlur(src, (5, 5), 0)
        for lo, hi in ((30, 100), (50, 150), (75, 200)):
            edges = cv2.Canny(blur, lo, hi)
            edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
            edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
                area = cv2.contourArea(c)
                if area < 0.15 * area_total:
                    break
                peri = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.02 * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    candidates.append((area, approx))
                    break
    if candidates:
        area, best = max(candidates, key=lambda x: x[0])
        conf = min(1.0, 0.55 + area / area_total * 0.5)
        return _order(best / scale), conf
    # Fallback: rotated rectangle around the largest bright region
    contours, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        c = max(contours, key=cv2.contourArea)
        if cv2.contourArea(c) > 0.25 * area_total:
            box = cv2.boxPoints(cv2.minAreaRect(c))
            return _order(box / scale), 0.4
    return None, 0.0


@app.post("/scan/detect")
async def scan_detect(request: Request):
    img = _decode(await request.body())
    h, w = img.shape[:2]
    corners, conf = _find_page(img)
    if corners is None:
        m = 0.04
        pts = [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]]
        return {"found": False, "confidence": 0, "corners": pts, "width": w, "height": h}
    pts = [[float(np.clip(x / w, 0, 1)), float(np.clip(y / h, 0, 1))] for x, y in corners]
    return {"found": True, "confidence": round(conf, 2), "corners": pts, "width": w, "height": h}


def _enhance(img: np.ndarray) -> np.ndarray:
    """Even out shadows and make the paper white (like a scanner's 'clear' mode)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    k = max(15, (min(gray.shape) // 25) | 1)
    background = cv2.medianBlur(cv2.dilate(gray, np.ones((7, 7), np.uint8)), k)
    norm = cv2.divide(gray, background, scale=255)
    norm = cv2.normalize(norm, None, 0, 255, cv2.NORM_MINMAX)
    # Gentle contrast curve: keep thin strokes and decimal points intact (OCR needs them).
    lut = np.clip((np.arange(256) - 40) * 255.0 / 200.0, 0, 255).astype("uint8")
    return cv2.LUT(norm, lut)


@app.post("/scan/warp")
async def scan_warp(request: Request, corners: str, enhance: bool = True):
    img = _decode(await request.body())
    h, w = img.shape[:2]
    try:
        pts = np.array(json.loads(corners), dtype="float32").reshape(4, 2)
    except Exception:
        raise HTTPException(400, "bad corners")
    pts = _order(np.clip(pts, 0, 1) * np.array([w, h], dtype="float32"))
    tl, tr, br, bl = pts
    out_w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    out_h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    if out_w < 50 or out_h < 50:
        raise HTTPException(400, "area too small")
    s = min(1.0, 2400.0 / max(out_w, out_h))
    out_w, out_h = int(out_w * s), int(out_h * s)
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype="float32")
    warped = cv2.warpPerspective(img, cv2.getPerspectiveTransform(pts, dst), (out_w, out_h), flags=cv2.INTER_CUBIC)
    result = _enhance(warped) if enhance else warped
    ok, jpg = cv2.imencode(".jpg", result, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise HTTPException(500, "encode failed")
    return Response(jpg.tobytes(), media_type="image/jpeg")
