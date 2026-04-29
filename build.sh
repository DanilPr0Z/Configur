#!/bin/bash
set -e

echo "==> Установка Python-зависимостей..."
pip install -r requirements.txt

echo "==> Установка Node-зависимостей и сборка фронтенда..."
cd frontend
npm install
npm run build
cd ..

echo "==> Сборка статики Django..."
python manage.py collectstatic --noinput

echo "==> Применение миграций..."
python manage.py migrate --noinput

echo "==> Готово!"
