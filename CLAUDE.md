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
├── docs/
│   └── CASCATE.md           # интеграция с внешним API cascate.ru
├── panels/
│   ├── models.py            # ВСЕ модели (см. ниже)
│   ├── views.py             # ViewSets + custom actions
│   ├── serializers.py       # сериализаторы
│   ├── cascate.py           # клиент внешнего API cascate.ru
│   ├── urls.py              # DefaultRouter
│   ├── admin.py
│   └── migrations/
│       └── 0010_...cascate...py     # последняя миграция
├── frontend/
│   └── src/
│       ├── api.ts                   # ВСЕ типы TypeScript и API-вызовы
│       ├── App.tsx                  # роутинг (/, /wall-60, /wall-50, /framing,
│       │                            # /orders, /orders/:id, /framing-leads, /joint-images*)
│       │                            # * /joint-images скрыт из навигации
│       │                            # Routes обёрнуты в ErrorBoundary
│       ├── pages/
│       │   ├── Configurator.tsx
│       │   ├── Framing.tsx
│       │   ├── FramingLeads.tsx     # заявки обрамления в ЛК
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
| POST | `orders/{id}/export_cascate/` | Выгрузка панелей в cascate.ru (`login`, `password`, `force?`) — см. `docs/CASCATE.md` |
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
- Кастомный селект узлов с превью — `JointSelect.tsx` (переиспользовать, не дублировать).
  Превью открывается слева, если справа не хватает места, — не ломать этот расчёт
- Стили: inline CSS + классы из `index.css`, без внешних UI-библиотек

### Геометрия стены (`Configurator.tsx`)

Стена описывается сеткой «столбцы × ряды», из которой `calcWall` собирает
список фактических панелей `cells`; спецификация, профили, развёртка и таблица
кромок считаются ТОЛЬКО по нему, а не по сетке напрямую.

| Поле `WallSeg` | Что задаёт |
|----------------|------------|
| `panelWidths` + `widthMode` | ширины столбцов: авто поровну или вручную |
| `rowHeights` + `heightMode` | высоты рядов, общие для всей стены |
| `colRowHeights[i]` | своя разбивка столбца `i` по рядам (верхний ряд-добор, как П52/П53 в СП); пусто — общая |
| `merges[]` | объединение панелей: прямоугольник от `(row, col)` на `span` столбцов и `rowSpan` рядов |
| `drawCode` | обозначение участка на чертеже («П50»); задано — панели нумеруются `п.1, п.2…`, пусто — сквозные `А1, А2…` |

Правила, которые легко нарушить:
- ширина объединённой панели включает зазор убранного шва: `−offset` узла
  соединения (C → +4 мм, R → +6, B → 0), высота — так же по `rowConn`;
- объединение принимается, только если его прямоугольник целиком существует и
  ряды в задетых столбцах лежат одинаково; иначе молча игнорируется;
- профили считаются по кромкам панелей из `cells` — на убранном шве профиля нет;
- лимиты листа проверяются по фактическому размеру панели (объединённая легко
  выходит за 1200 мм — это ожидаемое предупреждение, а не баг).

### Тесты

`frontend/src/pages/wallCalc.test.ts` — геометрия стен (раскладка, ряды по
столбцам, объединения, кромки, панель над дверью).
`frontend/src/framing/framingData.test.ts` — обрамление: формулы, глубина
добора, надбавка 15 %, контрольный заказ PASSO 2695×1018×200 = 51 426 ₽.

Цифры в тестах — подтверждённые производством эталоны. Если тест упал после
правки расчёта, сначала выясни, какая цифра правильная, и только потом меняй
ожидание в тесте.

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
6. ~~Прайс STEP полки~~ — закрыт 09.09.2026: узел `STEP` («Полка Step»),
   поправка −3,5 мм, 100 ₽/пог.м (Виталий Габбасов). Отдельный код, а не буква
   `S` со схемы: `S` в конфигураторе уже занят стыком рядов в сохранённых заказах

---

## Каталог (справочники) и заказы: хранение

`db.sqlite3` **не в git** (заказы, панели, заявки, медиа — это runtime-данные).
Справочники (каталог) версионируются отдельно фикстурой:

- **Файл:** `panels/fixtures/catalog.json` — коммитим. Содержит:
  `JointType, FinishGroup, Finish, ProfileColor, AluminumProfile,
   FramingProfilePrice, FramingModel, FramingColor, FramingDoborGroup, FramingDobor`.
  НЕ содержит `Order/Panel/DoorPanel/FramingLead`.
- **Деплой** (`deploy.sh`) после `migrate` делает `loaddata catalog.json` —
  сервер получает актуальный каталог, заказы не затрагиваются (loaddata пишет по PK
  только справочные таблицы). БД бэкапится перед `git pull`.

**Цены: опт vs розница.** В листе «Отделки» Excel-файлов колонка **D**
(«ЦЕНА КВ.М отделка») — себестоимость, **E** («ЦЕНА») — розница: `E = D × J2`,
где `J2 = 8.5` (для групп ШПОН 1,5/2,5/5 мм ещё `× 1.12`), часть строк задана
константой. Расчёт панели в Excel берёт именно E, поэтому `Finish.price_sqm`
хранит E. Так же и профили: в блоке цен листа «Отделки» **M** («ЦЕНА ЗА 3000
мм») — розница, **N** («Цена наша») — закупка; `AluminumProfile.price_per_piece`
хранит M. `load_excel` читает E и M — при обновлении файлов колонки не путать.

**Группы отделок.** Список групп — колонка **G** листа «Отделки» (диапазон
валидации поля «ГРУППА ОТДЕЛОК»), состав каждой — одноимённый **именованный
диапазон** книги: в Excel список отделок задан как `INDIRECT(<группа>)`.
Групп STONE / WOOD / FRASSINO OLD в файле нет — камни, HPL «под дерево» и
артикулы «(PELLE)» входят в КОМПОЗИТ, «* FRASSINO OLD» — в FRASSINO, КОЖА это
только Pele. Угадывать группу по названию отделки нельзя.

**После правки цен/узлов/отделок локально — перегенерировать фикстуру:**
```bash
python manage.py dumpdata \
  panels.jointtype panels.finishgroup panels.finish panels.profilecolor panels.aluminumprofile \
  panels.framingprofileprice panels.framingmodel panels.framingcolor panels.framingdoborgroup panels.framingdobor \
  --indent 2 --output panels/fixtures/catalog.json
```
Затем закоммитить `catalog.json` и задеплоить.

Перезалить каталог из Excel (флаг `--prune` удаляет отделки, которых в файле
уже нет, кроме занятых в заказах):
```bash
python manage.py load_excel --series 60 --file "NUOVO 60. Расчет стеновых панелей (учет узлов) 26.11.2025.xlsx" --prune
python manage.py load_excel --series 50 --file "News/NUOVO_50_Расчет_стеновых_панелей_учет_узлов_02_02_2026.xlsx" --prune --skip-shared
```
Excel-файлы в git не хранятся (`.gitignore: *.xlsx`), на сервере каталог
приезжает только фикстурой.

**Обрамление: источники правды** (папка `News/`, от Виталия Габбасова):
- `cascate_calculator.html` — эталонный калькулятор, по нему сверяется логика расчёта;
- `Обрамление_проема_КАЛЬКУЛЯТОР_v3.xlsx` — старые модели;
- `Чертёж - Frame и Shade (новые модели).pdf` — новые модели Frame/Shade (21.07.2026);
- `News/schemes/` — схемы моделей; старые в `.jpg`, Frame/Shade в `.png` (не переименовывать),
  дубль для фронта — `frontend/public/schemes/`.

**Стеновые: источники чертежей**
- NUOVO 60 — справочные листы `frontend/public/scheme1.png`, `scheme2.png`;
  чертежи узлов — `media/joints/joint_<CODE>.png`.
- NUOVO 50 — `frontend/public/scheme1-50.png`, `scheme2-50.png` и `media/joints/joint_<CODE>_50.png`
  собраны из картинок официального файла `News/NUOVO_50_Расчет_стеновых_панелей_учет_узлов_02_02_2026.xlsx`
  (`unzip xl/media/*`: 11 — план + расчёт ширины, 12 — разрезы + расчёт высоты,
  18–27 — узлы и коробка Complanar 50). Чертежи 60 и 50 РАЗНЫЕ — не переиспользовать.

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

# Тесты расчёта (vitest)
cd frontend && npm test

# Сборка фронтенда
cd frontend && npm run build
```

---

## Доступ и разделение по аккаунтам

Весь API закрыт: `DEFAULT_PERMISSION_CLASSES = panels.permissions.RequireCascateLogin`.
Вошедшим считается тот, кто прислал непустой заголовок `X-Cascate-Id` (фронт
кладёт `id_person` после входа через cascate.ru и цепляет его axios-интерцептором).
Открыты только вход (`auth/cascate-login/`) и выгрузка заказа в cascate
(`orders/{id}/export_cascate/` — там своя проверка логина).

Заказы и заявки обрамления принадлежат аккаунту: при создании в
`cascate_id_person` пишется id создателя, а `get_queryset` отдаёт свои записи
плюс записи **без владельца** — они остались от версии до разделения и видны
всем. Панели фильтруются через `order__cascate_id_person`, поэтому чужой заказ
даёт 404, а не 403.

Важно: заголовок не проверяется на стороне cascate.ru — любой, кто подставит
чужой id_person, получит доступ к его заказам. Для реальной защиты нужна
проверка id_person через API cascate или собственные сессии.

На фронте маршруты обёрнуты в `AuthGate` (`components/AuthGate.tsx`): без входа
показывается экран «Нужен вход», а не пустые страницы с ошибками.

---

## Важные ограничения

- `db.sqlite3` — единственная БД, нет PostgreSQL
- Медиафайлы хранятся локально в `media/` (не S3)
- `SECRET_KEY` в settings.py — только для локальной разработки, не для production
- `DEBUG = True` и `ALLOWED_HOSTS = []` — только dev-режим
