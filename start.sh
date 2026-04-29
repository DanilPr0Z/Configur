#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Убиваем старые процессы если они были
echo "Останавливаем старые процессы..."
pkill -f "manage.py runserver" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Django
echo "Запуск Django бэкенда на http://localhost:8000"
cd "$PROJECT_DIR"
source .venv/bin/activate
python manage.py runserver &
DJANGO_PID=$!

# Vite (React)
echo "Запуск React фронтенда на http://localhost:5173"
cd "$PROJECT_DIR/frontend"
npm run dev &
VITE_PID=$!

echo ""
echo "Сервисы запущены:"
echo "  Бэкенд  (Django):  http://localhost:8000"
echo "  Фронтенд (React):  http://localhost:5173  ← открывай это в браузере"
echo ""
echo "Нажмите Ctrl+C для остановки"

trap "echo 'Остановка...'; kill $DJANGO_PID $VITE_PID 2>/dev/null; exit 0" INT TERM
wait
