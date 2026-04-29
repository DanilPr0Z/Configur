# CLAUDE.md — NUOVO 60

Инструкции для Claude Code и агентной команды. Читать перед любыми изменениями.

---

## Проект

**NUOVO 60** — система конфигурации и расчёта заказов стеновых панелей.
Монорепо: Django-бэкенд + React-фронтенд в одной директории.

---

## Стек и запуск

### Backend (Django 4.2 + DRF)
```bash
# Активировать venv
source .venv/bin/activate

# Запуск
python manage.py runserver          # порт 8000

# Миграции
python manage.py makemigrations panels
python manage.py migrate

# Django Admin
python manage.py createsuperuser
# http://localhost:8000/admin/
```

### Frontend (React + TypeScript + Vite)
```bash
cd frontend
npm install
npm run dev                         # порт 5173
npm run build
```

### Параллельный запуск (dev)
Открыть два терминала:
1. `source .venv/bin/activate && python manage.py runserver`
2. `cd frontend && npm run dev`

---

## Структура проекта

```
PythonProject9/
├── config/
│   ├── settings.py          # настройки Django (MEDIA, CORS, DRF)
│   ├── urls.py              # главный urls + media serving
│   └── wsgi.py
├── panels/
│   ├── models.py            # ВСЕ модели (см. ниже)
│   ├── views.py             # ViewSets + custom actions
│   ├── serializers.py       # сериализаторы
│   ├── urls.py              # DefaultRouter
│   ├── admin.py
│   └── migrations/
│       └── 0008_jointtype_image.py  # последняя миграция
├── frontend/
│   └── src/
│       ├── api.ts                   # ВСЕ типы TypeScript и API-вызовы
│       ├── App.tsx                  # роутинг (/, /orders, /orders/:id, /joint-images)
│       ├── pages/
│       │   ├── Configurator.tsx
│       │   ├── OrdersList.tsx
│       │   ├── OrderDetail.tsx
│       │   └── JointImages.tsx
│       └── components/
│           ├── PanelRow.tsx
│           ├── DoorPanelRow.tsx
│           ├── WallCalculator.tsx
│           ├── WallScheme.tsx
│           ├── JointSelect.tsx      # кастомный селект с превью фото
│           └── OrderSummaryView.tsx
├── media/
│   └── joints/              # фото узлов (ImageField)
├── db.sqlite3
└── .venv/
```

---

## Модели данных

### Справочники (read-only через API)
| Модель | Описание |
|--------|----------|
| `JointType` | Тип узла (A, B, C, D, DG, DH, G, H, E, FL, FR, P, R, I, O, S, T). Поля: `code`, `name`, `offset_mm`, `price_per_meter`, `profile_article`, `profile_count`, `image` |
| `FinishGroup` | Группа отделки (ШПОН, STONE, LACATO и др.) |
| `Finish` | Отделка с ценой руб/кв.м, привязана к FinishGroup |
| `ProfileColor` | Цвет алюминиевого профиля |
| `AluminumProfile` | Профиль с артикулом, ценой, привязкой к коду узла |

### Основные сущности
| Модель | Описание |
|--------|----------|
| `Order` | Заказ. Поля: customer_name, agent_name, counterparty, order_number, invoice_number, order_date, city, notes |
| `Panel` | Стеновая панель в заказе. 4 узла (left/right/top/bottom), отделка, алюм. декор. Computed: area_sqm, total_cost |
| `DoorPanel` | Панель над дверью. 3 узла соединения + 4 кромки. Computed: area_sqm, total_cost |

---

## API эндпоинты

Base URL: `http://localhost:8000/api/`

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `joint-types/` | Список узлов |
| POST | `joint-types/{id}/upload-image/` | Загрузить фото узла (field: `image`) |
| DELETE | `joint-types/{id}/delete-image/` | Удалить фото |
| GET | `finish-groups/` | Группы отделок + вложенные отделки |
| GET | `profile-colors/` | Цвета профилей |
| GET | `aluminum-profiles/` | Алюминиевые профили |
| GET/POST | `orders/` | Список/создание заказов |
| GET/PATCH/DELETE | `orders/{id}/` | Заказ (detail включает panels + door_panels) |
| GET | `orders/{id}/summary/` | Итоговая спецификация с алюм. профилями |
| POST | `orders/{id}/import_excel/` | Импорт панелей из xlsx (field: `file`) |
| POST | `orders/calculate_wall/` | Калькулятор раскладки панелей |
| GET/POST/PATCH/DELETE | `panels/` | CRUD панелей (фильтр: ?order=ID) |
| GET/POST/PATCH/DELETE | `door-panels/` | CRUD дверных панелей (фильтр: ?order=ID) |

### image_url
`JointType.image` сериализуется как `image_url` — абсолютный URL (`http://localhost:8000/media/joints/...`).
В TypeScript-интерфейсе: `image_url: string | null`.

---

## Импорт Excel

Лист: **«Ввод данных к заказу»**
- Шапка заказа: строки 62–72, колонка E (5)
- Панели: строки 145–174, колонки 3–19

При импорте все существующие панели заказа **удаляются** и пересоздаются.

---

## Правила разработки

### Общие
- Не создавать файлы без необходимости — предпочитать редактирование существующих
- Не добавлять избыточные абстракции, хелперы, error handling для невозможных сценариев
- Не трогать `.venv/` и `node_modules/` — только читать при необходимости
- Не коммитить `db.sqlite3`, `media/`, `.env`

### Backend (Django)
- Все модели — только в `panels/models.py`
- После изменения моделей: `makemigrations panels` + `migrate`
- Бизнес-логика (вычисляемые поля) — как `@property` на модели, не в сериализаторах
- Computed-поля добавлять в сериализатор как `read_only=True`
- `get_serializer_context()` передаёт `request` для построения абсолютных URL медиа
- CORS открыт для всех (`CORS_ALLOW_ALL_ORIGINS = True`) — только для dev
- Язык: `ru-ru`, часовой пояс: `Europe/Moscow`

### Frontend (React + TypeScript)
- Все типы и API-функции — только в `frontend/src/api.ts`
- При добавлении нового поля в API: обновить интерфейс в `api.ts` и использование в компоненте
- Роутинг только в `App.tsx`
- Кастомный селект узлов с превью — `JointSelect.tsx` (переиспользовать, не дублировать)
- Стили: inline CSS + классы из `index.css`, без внешних UI-библиотек

---

## Использование навыков и агентов

### Когда использовать скилы

| Задача | Скил |
|--------|------|
| Добавление/рефакторинг Django views, serializers, models | `senior-backend` |
| Добавление/рефакторинг React компонентов, страниц | `senior-frontend` |
| Редизайн UI, новые визуальные компоненты | `frontend-design` |

### Агентная команда (Agent tool)

Использовать `Agent` (subagent_type=Explore) когда:
- Нужно исследовать несколько файлов одновременно (например, отследить связь models → serializers → api.ts → компонент)
- Задача требует более 3 поисковых запросов

Параллельные вызовы инструментов:
- `Read` нескольких файлов можно запускать **одновременно** если они независимы
- `Glob` и `Grep` — параллельно при независимых поисках
- Запросы к БД через Django shell не мешают чтению файлов — параллелить

### Типичные сценарии работы агентов

**Добавление нового поля в модель:**
1. Agent читает `models.py` + `serializers.py` + `api.ts` параллельно
2. Вносит изменения в модель → сериализатор → TypeScript-интерфейс
3. Создаёт миграцию

**Новый API action:**
1. Добавить метод во ViewSet (`views.py`) с `@action`
2. Добавить TypeScript-функцию в `api.ts`
3. Использовать в нужном компоненте/странице

**Новая страница:**
1. Создать файл в `frontend/src/pages/`
2. Добавить `<Route>` в `App.tsx`
3. Добавить ссылку в навигацию (`App.tsx` → `<nav>`)

---

## Нереализованный функционал (roadmap)

Приоритет реализации:
1. Ручной ввод дополнительных профилей в спецификации (поверх авторасчёта)
2. Услуга фрезеровки (узел Р) — отдельная секция в заказе
3. Профиль-декор П-образный 6×6 — отдельная секция
4. Экспорт спецификации в Excel / PDF
5. Каталог 3D фрезеровок (1.5 мм / 2.5 мм)
6. Прайс STEP полки

---

## Частые команды

```bash
# Проверить миграции
python manage.py showmigrations panels

# Django shell (отладка)
python manage.py shell

# Сбросить и переприменить миграции (осторожно — потеря данных)
python manage.py migrate panels zero && python manage.py migrate panels

# Тип-чек TypeScript
cd frontend && npx tsc --noEmit

# Сборка фронтенда
cd frontend && npm run build
```

---

## Важные ограничения

- `db.sqlite3` — единственная БД, нет PostgreSQL
- Нет аутентификации/авторизации (открытый API)
- Медиафайлы хранятся локально в `media/` (не S3)
- `SECRET_KEY` в settings.py — только для локальной разработки, не для production
- `DEBUG = True` и `ALLOWED_HOSTS = []` — только dev-режим
