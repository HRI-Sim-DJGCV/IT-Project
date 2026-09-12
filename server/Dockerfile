FROM python:3.13-slim

# System dependencies:
# - build-essential: numba/llvmlite may build from source
# - libsndfile1: soundfile
# - ffmpeg: wav -> mp3 conversion
# - sox, libgomp1: audio tooling and the OpenMP runtime torch/numba need
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

# Internal service: only the Node API talks to it. Compose does not publish this port.
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
