# Структура заказа JSON (для производства)

Полный заказ одним JSON-объектом. Пример с реальными данными:
[`cascate-order-schema.example.json`](./cascate-order-schema.example.json).

В отличие от `addPanel` (плоская форма, одна панель на запрос) — здесь весь заказ
вложенной структурой, удобно парсить целиком.

---

## Верхний уровень

```jsonc
{
  "source": "nuovo60",     // строка-источник, всегда "nuovo60"
  "order":  { ... },       // шапка заказа
  "panels": [ ... ],       // массив панелей (стеновые + дверные вперемешку)
  "totals": { "panels_count": 17 }
}
```

## `order` — шапка

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | int | ID заказа в NUOVO |
| `series` | string | Серия: `"60"` или `"50"` |
| `order_number` | string | Номер заказа |
| `invoice_number` | string | Номер счёта |
| `order_date` | string \| null | Дата принятия, `YYYY-MM-DD` |
| `customer_name` | string | ФИО заказчика |
| `agent_name` | string | ФИО агента |
| `counterparty` | string | Контрагент |
| `city` | string | Город |
| `notes` | string \| null | Примечание к заказу |

## `panels[]` — общие поля

| Поле | Тип | Описание |
|------|-----|----------|
| `external_id` | string | Уникальный ключ: `panel-<id>` или `door-<id>` (для дедупликации) |
| `type` | string | `"wall"` (стеновая) или `"door"` (над дверью) |
| `position` | int | Порядковый № панели в заказе |
| `wall_number` | string | № стены/отрезка |
| `quantity` | int | Количество, шт |
| `size_mm` | object | `{ "height": число, "width": число }` — габарит панели, мм |
| `area_sqm` | number | Площадь одной панели, кв.м |
| `finish` | object | `{ "group", "name", "decor" }` — группа отделки, отделка, 3D-декор (любое может быть null) |
| `veneer_direction` | string \| null | Направление шпона |
| `markup_percent` | number | Наценка, % |
| `cost` | number | Стоимость за всё количество, с наценкой, без НДС, руб |
| `notes` | string \| null | Примечание к панели |

## Только `type: "wall"`

| Поле | Тип | Описание |
|------|-----|----------|
| `joints` | object | `{ "left", "right", "top", "bottom" }` — коды узлов (`A`,`C`,`D`,`DG`,`H`,`G`,`FR`…), null если нет |
| `aluminum` | object | `{ "vertical_count", "horizontal_count", "color" }` — алюминиевый декор |

## Только `type: "door"`

| Поле | Тип | Описание |
|------|-----|----------|
| `door_order_number` | string \| null | № заказа дверного полотна |
| `opening_mm` | object | `{ "width", "height", "ceiling_height" }` — проём и высота потолка, мм |
| `mount_type` | string | Тип монтажа (`ceiling`…) |
| `opening_direction` | string | Открывание (`in` внутрь / `out` наружу) |
| `joints` | object | `{ "top_left", "top_right", "bottom" }` — коды узлов соединения |
| `edges` | object | `{ "left", "right", "top", "bottom" }` — коды кромок |

---

## Замечания

- Числа — обычные JSON-числа (не строки). В `addPanel` они шли строкой с 2 знаками —
  здесь для парсинга удобнее числом. Если для производства нужен строковый формат — скажите.
- Пустые значения — `null`, а не пустая строка.
- Коды узлов и кромок — те же справочники, что в конфигураторе.
- Если нужен другой набор полей/имён под вашу систему — правится в одном месте, скажите какой.
