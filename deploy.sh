#!/usr/bin/env bash
# Деплой NUOVO 60 / panels.cascate.ru
# Запускать ПОД ROOT из корня проекта:  sudo bash deploy.sh
#
# Git тянем под пользователем site (владелец репозитория и сокета),
# Django-часть и рестарт — под root. Заказы (db.sqlite3) не в git,
# бэкапим их и возвращаем владельца, иначе gunicorn (site) не запишет в БД.
set -e

APP_DIR=/var/www/cascate.ru/panels
APP_USER=site
cd "$APP_DIR"

echo "==> Бэкап БД с заказами"
[ -f db.sqlite3 ] && cp db.sqlite3 db.sqlite3.bak

echo "==> git pull (под $APP_USER)"
sudo -u "$APP_USER" git checkout -- db.sqlite3 2>/dev/null || true
sudo -u "$APP_USER" git pull

# Если pull убрал рабочую БД (переход в untracked) — восстанавливаем из бэкапа.
[ ! -f db.sqlite3 ] && [ -f db.sqlite3.bak ] && cp db.sqlite3.bak db.sqlite3

echo "==> Python: зависимости, миграции, каталог"
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
# Справочники (каталог) из фикстуры. Заказы не трогаются.
python manage.py loaddata catalog.json

# ВАЖНО: сборка фронта — ДО collectstatic. Vite даёт файлам новые хеши в имени
# (assets/index-<hash>.js), и index.html ссылается на них как /static/assets/...
# Если собрать после collectstatic, в staticfiles останутся файлы прошлой сборки,
# новый index.html будет ссылаться на несуществующие → 404 и белый экран.
echo "==> Сборка фронтенда"
cd frontend
npm install
npm run build
cd ..

echo "==> Статика (после сборки фронта)"
python manage.py collectstatic --noinput

echo "==> Возврат владельца файлов пользователю $APP_USER"
chown "$APP_USER":"$APP_USER" db.sqlite3
chown -R "$APP_USER":"$APP_USER" frontend/dist staticfiles static 2>/dev/null || true

echo "==> Рестарт gunicorn (supervisor)"
supervisorctl restart panels
supervisorctl status panels

echo "==> Готово"
