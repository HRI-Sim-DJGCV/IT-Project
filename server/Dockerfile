FROM python:3.13-slim

# System dependencies:
# - build-essential: needed to build numba/llvmlite from source (no prebuilt wheels for some combos)
# - libsndfile1: required by soundfile
# - ffmpeg: required by pydub / audio processing
# - sox: required by the sox python bindings
# - libgomp1: OpenMP runtime needed by numba/scikit-learn/torch
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    sox \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Adjust to match how you actually start the server (uvicorn/fastapi entrypoint, etc.)
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
