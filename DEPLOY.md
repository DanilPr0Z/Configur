# Деплой и обновление NUOVO 60

Стек: **Gunicorn + Nginx + systemd**. Django-бэкенд + React-фронт в одном репозитории.
Фронт собирается в `frontend/dist/`, статика Django — в `staticfiles/`.

- **Каталог путь на сервере:** `/var/www/cascate.ru/panels`
- **Сервис бэкенда:** `gunicorn` (systemd)
- **Хранение данных:** справочники (каталог) — в git через `panels/fixtures/catalog.json`;
  `db.sqlite3` (заказы, панели, заявки) **не в git** — живёт только на сервере.

> Не уверен в имени сервиса? Проверь: `systemctl list-units --type=service | grep -iE 'gunicorn|nuovo|panel'`

---

## ⚡ Срочно: поднять сайт при ошибке 500

Самая частая причина 500 на `/` — **не собран фронт** (`frontend/dist/index.html` отсутствует).
Чинится на текущем коде, без обновления:

```bash
cd /var/www/cascate.ru/panels
source .venv/bin/activate

cd frontend
npm install
npm run build          # ← если падает — это и есть причина 500, смотри вывод
cd ..

python manage.py collectstatic --noinput
sudo systemctl restart gunicorn
```

Проверить: открыть https://panels.cascate.ru/ и `sudo systemctl status gunicorn --no-pager | head`.

Если всё равно 500 — смотри точную ошибку:
```bash
sudo journalctl -u gunicorn -n 80 --no-pager
```
Последняя строка traceback называет исключение (`TemplateDoesNotExist` → фронт не собран;
`ModuleNotFoundError` → не встали зависимости; `Missing staticfiles manifest` → нет `collectstatic`).

---

## 🔄 Обычное обновление (штатное)

Одной командой — `deploy.sh` делает всё: `git pull`, зависимости, миграции,
заливку каталога, статику, сборку фронта, рестарт:

```bash
cd /var/www/cascate.ru/panels
bash deploy.sh
```

Что внутри `deploy.sh`:
1. бэкап `db.sqlite3` перед обновлением;
2. `git pull`;
3. `pip install -r requirements.txt`;
4. `migrate`;
5. **`loaddata catalog.json`** — обновляет справочники, заказы не трогает;
6. `collectstatic`;
7. `npm install && npm run build`;
8. `sudo systemctl restart gunicorn`.

---

## ⚠️ Разовый шаг при первом обновлении на новую схему

Начиная с версии, где `db.sqlite3` убран из git, **первый** `git pull` может конфликтовать
с базой на сервере. Делается один раз:

```bash
cd /var/www/cascate.ru/panels

# 1. Бэкап заказов (важно — база больше не в git)
cp db.sqlite3 /root/db.sqlite3.backup

# 2. Жёстко подтянуть новый main
git fetch origin
git reset --hard origin/main      # уберёт db.sqlite3 из дерева (теперь он в .gitignore)

# 3. Вернуть базу с заказами
cp /root/db.sqlite3.backup db.sqlite3

# 4. Полный деплой
bash deploy.sh
```

`git reset --hard` затрагивает только файлы под git. `.env` и `db.sqlite3.backup` — untracked, уцелеют.
Дальше обновление идёт обычным `bash deploy.sh` (шаг разовый).

---

## 🗂 Каталог (справочники): как обновлять цены/узлы

Данные каталога версионируются в `panels/fixtures/catalog.json`. Меняешь их **локально** через
Django-админку или код, затем перегенерируешь фикстуру и коммитишь:

```bash
# локально, после правок каталога
python manage.py dumpdata \
  panels.jointtype panels.finishgroup panels.finish panels.profilecolor panels.aluminumprofile \
  panels.framingprofileprice panels.framingmodel panels.framingcolor panels.framingdoborgroup panels.framingdobor \
  --indent 2 --output panels/fixtures/catalog.json

git add panels/fixtures/catalog.json && git commit -m "Обновить каталог"
git push
```

На сервере `bash deploy.sh` сам зальёт новый каталог через `loaddata`. **Заказы при этом не затрагиваются.**

---

## 🛠 Управление сервисами и логи

```bash
# Бэкенд
sudo systemctl restart gunicorn
sudo systemctl status gunicorn --no-pager
sudo journalctl -u gunicorn -n 80 --no-pager     # логи / traceback

# Nginx (если правил конфиг)
sudo nginx -t && sudo systemctl reload nginx
sudo tail -n 50 /var/log/nginx/error.log
```

Включить подробный traceback вместо «Internal Server Error»:
`DEBUG=True` в `.env` → **обязательно** `sudo systemctl restart gunicorn` (иначе не подхватится).
После диагностики вернуть `DEBUG=False` и снова перезапустить.

---

## Первичная установка (с нуля)

<details>
<summary>Развернуть</summary>

```bash
# Зависимости системы
apt update && apt install -y python3 python3-venv python3-pip nodejs npm nginx git

# Клонирование
cd /var/www/cascate.ru
git clone https://github.com/DanilPr0Z/Configur panels
cd panels

# venv + .env
python3 -m venv .venv
cp .env.example .env
nano .env    # SECRET_KEY, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CASCATE_TOKEN

# SECRET_KEY:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# Первая сборка + каталог
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py loaddata catalog.json          # залить справочники
python manage.py collectstatic --noinput
cd frontend && npm install && npm run build && cd ..

# Права на медиа
chown -R www-data:www-data media && chmod 755 media

# systemd + nginx
cp deploy/nuovo60.service /etc/systemd/system/gunicorn.service   # проверь пути внутри!
systemctl daemon-reload && systemctl enable gunicorn && systemctl start gunicorn
cp deploy/nginx.conf /etc/nginx/sites-available/panels
nano /etc/nginx/sites-available/panels          # домен, пути
ln -s /etc/nginx/sites-available/panels /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Суперпользователь для админки
python manage.py createsuperuser
```

**HTTPS (Let's Encrypt):**
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d panels.cascate.ru
```
</details>

---

## Переменные окружения (`.env`)

| Переменная | Локально | Продакшн |
|---|---|---|
| `SECRET_KEY` | дефолт (небезопасный) | **обязательно** свой |
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | `panels.cascate.ru` |
| `CORS_ALLOWED_ORIGINS` | не нужна | `https://panels.cascate.ru` |
| `CASCATE_TOKEN` | токен приложения cascate.ru | тот же |
