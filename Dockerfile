FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY apps/api_py /app/apps/api_py
RUN pip install --upgrade pip && pip install /app/apps/api_py

WORKDIR /app/apps/api_py
USER app

EXPOSE 4000

CMD ["sh", "-c", "python scripts/migrate.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4000}"]
