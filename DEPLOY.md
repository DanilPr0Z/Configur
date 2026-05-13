# Деплой NUOVO 60 на Debian

Стек: Gunicorn + Nginx + systemd. Фронтенд собирается в `frontend/dist/`, отдаётся nginx напрямую.

---

## 1. Подготовка сервера

```bash
apt update && apt install -y python3 python3-venv python3-pip nodejs npm nginx git
```

---

## 2. Клонирование и настройка

```bash
cd /var/www
git clone https://github.com/DanilPr0Z/Configur nuovo60
cd nuovo60

# Создать venv
python3 -m venv .venv

# Создать .env
cp .env.example .env
nano .env   # заполнить SECRET_KEY и ALLOWED_HOSTS
```

**Генерация SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Пример заполненного `.env`:
```
SECRET_KEY=ваш-случайный-ключ-50-символов
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

---

## 3. Сборка

```bash
bash build.sh
```

Скрипт:
- устанавливает Python-зависимости
- собирает React-фронтенд (`npm run build`)
- собирает статику Django (`collectstatic`)
- применяет миграции

---

## 4. Права на медиафайлы

```bash
chown -R www-data:www-data /var/www/nuovo60/media
chmod 755 /var/www/nuovo60/media
```

---

## 5. Systemd-сервис

```bash
cp deploy/nuovo60.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable nuovo60
systemctl start nuovo60
systemctl status nuovo60
```

---

## 6. Nginx

```bash
# Отредактировать конфиг под свой домен
cp deploy/nginx.conf /etc/nginx/sites-available/nuovo60
nano /etc/nginx/sites-available/nuovo60   # заменить yourdomain.com

ln -s /etc/nginx/sites-available/nuovo60 /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 7. Создать суперпользователя

```bash
cd /var/www/nuovo60
.venv/bin/python manage.py createsuperuser
```

Админ-панель: `https://yourdomain.com/admin/`

---

## 8. HTTPS (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Обновление после изменений в коде

```bash
cd /var/www/nuovo60
git pull
bash build.sh
systemctl restart nuovo60
```

---

## Локальный запуск (разработка)

```bash
# Терминал 1 — бэкенд
source .venv/bin/activate
python manage.py runserver

# Терминал 2 — фронтенд
cd frontend && npm run dev
```

Или одной командой: `bash start.sh`

---

## Структура переменных окружения

| Переменная | Локально | Продакшн |
|---|---|---|
| `SECRET_KEY` | дефолт (небезопасный) | **обязательно** |
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | ваш домен |
| `CORS_ALLOWED_ORIGINS` | не нужна | `https://ваш-домен` |
