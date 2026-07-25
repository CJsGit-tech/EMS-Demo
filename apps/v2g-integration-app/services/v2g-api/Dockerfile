FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src

RUN pip install --no-cache-dir . \
    && useradd --create-home --shell /usr/sbin/nologin v2g

USER v2g

EXPOSE 8000

CMD ["sh", "-ec", "alembic upgrade head && python -m v2g.bootstrap && exec uvicorn v2g.app:app --host 0.0.0.0 --port 8000"]
