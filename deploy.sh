#!/usr/bin/env bash
set -e
git pull
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
cd frontend
npm install
npm run build
cd ..
sudo systemctl restart gunicorn
