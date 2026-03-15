#!/bin/sh
set -eu

# Ensure the database is initialized before starting
python -m scripts.init_db

exec uvicorn app.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
