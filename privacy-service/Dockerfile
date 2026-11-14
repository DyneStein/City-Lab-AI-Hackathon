# LabWala sidecar: Presidio (PII), OpenCV (page detection/flattening), edge-tts (neural voices)
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
      "presidio-analyzer>=2.2" "fastapi>=0.110" "uvicorn>=0.29" "edge-tts>=7.3.1" \
      "opencv-python-headless>=4.10" "numpy>=2" \
      https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
COPY app.py .
EXPOSE 8790
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8790/health')"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8790"]
