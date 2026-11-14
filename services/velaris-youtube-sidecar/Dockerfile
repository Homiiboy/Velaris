FROM node:24-bookworm-slim AS js-runtime

FROM python:3.12-slim-bookworm
# yt-dlp's YouTube EJS challenge solver needs a supported JS runtime.
COPY --from=js-runtime /usr/local/bin/node /usr/local/bin/node

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd -r -u 10001 -m velaris && mkdir -p /downloads && chown velaris:velaris /downloads
USER velaris
EXPOSE 8787
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
