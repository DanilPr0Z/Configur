#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Python-зависимости..."
.venv/bin/pip install -r requirements.txt

echo "==> Сборка фронтенда..."
cd frontend
npm install
npm run build
cd ..

echo "==> Статика Django..."
.venv/bin/python manage.py collectstatic --noinput

echo "==> Миграции..."
.venv/bin/python manage.py migrate --noinput

echo "==> Готово!"
