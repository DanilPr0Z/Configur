# Деплой NUOVO 60 на Railway

## Что уже подготовлено в проекте

| Файл | Назначение |
|------|-----------|
| `requirements.txt` | Python-зависимости |
| `Procfile` | Команда запуска для Railway |
| `railway.json` | Конфигурация Railway |
| `build.sh` | Скрипт сборки (фронтенд + миграции + статика) |
| `config/settings.py` | Настройки через переменные окружения |
| `config/urls.py` | Отдача React SPA в продакшне |

---

## Деплой на Railway (шаг за шагом)

### 1. Зарегистрируйся на Railway

Открой [railway.app](https://railway.app) → **Login with GitHub**

---

### 2. Создай новый проект

- **New Project** → **Deploy from GitHub repo**
- Выбери репозиторий **DanilPr0Z/Configur**
- Railway автоматически начнёт первый деплой (он упадёт — пока не добавлены переменные)

---

### 3. Настрой переменные окружения

В Railway открой проект → вкладка **Variables** → добавь:

```
SECRET_KEY        = придумай-любую-длинную-строку-40+-символов
DEBUG             = False
ALLOWED_HOSTS     = твой-домен.railway.app
```

**Сгенерировать SECRET_KEY можно командой:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

### 4. Настрой команду сборки

В Railway → вкладка **Settings** → раздел **Build**:

```
Build Command:   bash build.sh
Start Command:   gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

---

### 5. Получи домен

В Railway → вкладка **Settings** → **Networking** → **Generate Domain**

Скопируй полученный домен (например `configur-production.up.railway.app`) и добавь его в переменную:
```
ALLOWED_HOSTS = configur-production.up.railway.app
```

Затем **Redeploy**.

---

### 6. Создай суперпользователя (один раз)

В Railway → вкладка **Deploy** → кнопка **Shell** (или через Railway CLI):

```bash
python manage.py createsuperuser
```

Админ-панель будет доступна по адресу: `https://твой-домен/admin/`

---

## Обновление после изменений в коде

```bash
# На своём Mac:
git add .
git commit -m "описание изменений"
git push
```

Railway автоматически пересоберёт и задеплоит проект при каждом пуше в `main`.

---

## Локальный запуск (для разработки)

```bash
# Терминал 1 — бэкенд
source .venv/bin/activate
python manage.py runserver

# Терминал 2 — фронтенд
cd frontend
npm run dev
```

Открыть: http://localhost:5173

---

## Структура переменных окружения

| Переменная | Локально | Продакшн |
|-----------|---------|---------|
| `SECRET_KEY` | не нужна (есть дефолт) | **обязательно** |
| `DEBUG` | `True` (дефолт) | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` (дефолт) | `твой-домен.railway.app` |

---

## Важные ограничения Railway (бесплатный план)

- **500 часов** работы в месяц (≈ 20 дней непрерывно)
- Приложение **засыпает** после 30 минут неактивности — первый запрос после сна займёт 10-15 секунд
- SQLite хранится на диске контейнера — при новом деплое **база данных сбрасывается**

> ⚠️ **Важно про базу данных:** SQLite-файл не сохраняется между деплоями на Railway.
> Все заказы/данные нужно либо перезаносить вручную, либо перейти на PostgreSQL (Railway предоставляет бесплатно).
> Подробнее — смотри секцию ниже.

---

## Подключение PostgreSQL (рекомендуется для продакшна)

### 1. Добавь PostgreSQL в проект Railway

В Railway → **New** → **Database** → **PostgreSQL**

Railway автоматически добавит переменную `DATABASE_URL` в окружение.

### 2. Установи psycopg2

```bash
source .venv/bin/activate
pip install psycopg2-binary dj-database-url
pip freeze > requirements.txt
```

### 3. Обнови `config/settings.py`

Добавь после блока DATABASES:

```python
import dj_database_url
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    DATABASES['default'] = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
```

### 4. Закоммить и запушить

```bash
git add requirements.txt config/settings.py
git commit -m "Add PostgreSQL support"
git push
```

После деплоя Railway автоматически применит миграции через `build.sh`.
