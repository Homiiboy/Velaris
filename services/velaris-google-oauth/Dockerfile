FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd -r -u 10002 -m velaris && mkdir -p /data && chown 10002:10002 /data
USER 10002
EXPOSE 8791
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8791","--no-access-log"]
