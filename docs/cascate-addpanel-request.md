# Структура запроса в cascate.ru — `addPanel`

Выгрузка панелей заказа из NUOVO 60 во внешний API cascate.ru.
Один HTTP-запрос на каждую панель.

---

## Транспорт

| | |
|---|---|
| Метод | `POST` |
| URL | `https://cascate.ru/Api/addPanel/` — **слеш в конце обязателен** (без него Apache отдаёт 301, POST-тело теряется) |
| Content-Type | `application/x-www-form-urlencoded` (не JSON) |
| Редиректы | запрещены (`allow_redirects=false`) |
| Cookie | `PHPSESSID` — только если перед этим вызван `login/` |

Перед выгрузкой вызывается `login/` (`token` + `login` + `password`) → возвращает `id_person`.

---

## `login/` — тело запроса

```
token=<CASCATE_TOKEN>
login=<email пользователя>
password=<пароль>
```

Ожидаемый ответ: `id_person` (в каком ключе — не подтверждено).

---

## `addPanel` — стеновая панель (`panel_type=wall`)

```
token=<CASCATE_TOKEN>        # общий токен приложения
id_person=<id_person>        # из login/

# — общее по заказу —
source=nuovo60
order_id=4
order_number=6476157675676716716576176716716
invoice_number=34567897654636789087564
customer_name=123456789
agent_name=12345
counterparty=23456
city=Ижевск

# — панель —
external_id=panel-77         # подсказка для дедупликации
panel_type=wall
position=1
wall_number=1
quantity=1
height=2688.00              # числа строкой, точка, 2 знака
width=983.50
area=2.64
joint_left=A                # коды узлов
joint_right=C
joint_top=
joint_bottom=
finish_group=
finish=
veneer_direction=
decor_name=
aluminum_vertical_count=0
aluminum_horizontal_count=0
aluminum_color=
markup_percent=0.00
cost=2284.80                # итог за всё кол-во, с наценкой, без НДС
notes=
```

Как уходит по проводу (`application/x-www-form-urlencoded`):

```
token=<CASCATE_TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-77&panel_type=wall&position=1&wall_number=1&quantity=1&height=2688.00&width=983.50&area=2.64&joint_left=A&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2284.80&notes=
```

---

## `addPanel` — дверная панель (`panel_type=door`)

Общие поля по заказу — те же. Вместо узлов/алюминия стеновой панели:

```
external_id=door-1
panel_type=door
position=1
wall_number=1
quantity=1
height=0.00
width=0.00
area=0.00
door_order_number=
opening_width=0.00
opening_height=0.00
ceiling_height=0.00
mount_type=ceiling
opening_direction=in
joint_top_left=
joint_top_right=
joint_bottom=
edge_left=
edge_right=
edge_top=
edge_bottom=
finish_group=
finish=
veneer_direction=
decor_name=
markup_percent=0.00
cost=0.00
notes=
```

---

## Ожидаемый ответ

- Успех: `id_panel` (в каком ключе — не подтверждено).
- Ошибка авторизации: `{"success":false,"mag":"Error auth"}`.
- Ошибка токена: `{"success":false,"error":"Не верный токен!"}`.

**Проблема на текущий момент:** `addPanel` возвращает пустое тело (`''`).
Вероятно, требуется активная сессия `PHPSESSID` от `login/`, либо не совпадает
состав/имена полей. Нужен ответ вашей стороны: какие поля и ключи ожидаются,
смотрите ли вы на сессию или только на `id_person`.
