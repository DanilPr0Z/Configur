#!/usr/bin/env bash
set -e

# БД с заказами не хранится в git. Бэкапим её перед обновлением, чтобы
# переход db.sqlite3 в untracked (или сбой pull) не уничтожил заказы.
[ -f db.sqlite3 ] && cp db.sqlite3 db.sqlite3.bak

git pull

# Если git удалил рабочую БД при pull этого коммита — восстанавливаем из бэкапа.
[ ! -f db.sqlite3 ] && [ -f db.sqlite3.bak ] && cp db.sqlite3.bak db.sqlite3

source .venv/bin/activate
pip install -r requirements.txt

python manage.py migrate --noinput
# Справочники (каталог) заливаем/обновляем из фикстуры. Заказы не трогаются.
python manage.py loaddata catalog.json
python manage.py collectstatic --noinput

cd frontend
npm install
npm run build
cd ..

sudo systemctl restart gunicorn
