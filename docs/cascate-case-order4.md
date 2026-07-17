# Конкретный случай выгрузки — заказ id=4 (скрин «Отправлено: 0 · с ошибкой: 17»)

Что реально ушло на cascate.ru и что вернулось.

---

## Что происходит по шагам

1. `POST https://cascate.ru/Api/login/` — обмен `token`+`login`+`password` на `id_person`
   (либо `id_person` берётся из уже выполненного входа пользователя в сайдбаре).
2. Далее по одному `POST https://cascate.ru/Api/addPanel/` **на каждую из 17 панелей**.
   Все 17 — стеновые (`panel_type=wall`), дверных в заказе нет.

Каждый `addPanel`:
- Content-Type: `application/x-www-form-urlencoded`
- слеш в конце URL обязателен, редиректы запрещены.

---

## Что вернул сервер (причина ошибки)

На **каждый** из 17 `addPanel` cascate.ru ответил **пустым телом** — `''`.
HTTP-статус был не-ошибочный и не редирект (иначе текст ошибки был бы другой),
то есть сервер принял запрос, но вернул **0 байт вместо JSON**.

Отсюда в интерфейсе на каждую панель: `addPanel: ответ не JSON — ''`.

Нужно понять с вашей стороны: почему `addPanel` отдаёт пустой ответ —
не хватает какого-то обязательного поля, не та сессия (`PHPSESSID`),
или не тот способ авторизации.

---

## Тела всех 17 запросов (urlencoded, как ушло по проводу)

`token` и `id_person` заменены на плейсхолдеры.

### Панель #1 (id=77)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-77&panel_type=wall&position=1&wall_number=1&quantity=1&height=2688.00&width=983.50&area=2.64&joint_left=A&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2284.80&notes=
```

### Панель #1 (id=80, стена 2)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-80&panel_type=wall&position=1&wall_number=2&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=A&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2284.80&notes=
```

### Панель #1 (id=83, стена 3) — с отделкой и алюминием
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-83&panel_type=wall&position=1&wall_number=3&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=D&joint_right=C&joint_top=D&joint_bottom=DG&finish_group=%D0%A8%D0%9F%D0%9E%D0%9D&finish=Dark+Grey+Oak&veneer_direction=%D0%93%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%BD%D1%82%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5&decor_name=Dark+Grey+Oak+5+%D0%BC%D0%BC&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=Dark+brown+Colour+2K&markup_percent=10.00&cost=11393.46&notes=
```

### Панель #1 (id=86, стена 4)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-86&panel_type=wall&position=1&wall_number=4&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=A&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2284.80&notes=
```

### Панель #1 (id=89, стена 5)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-89&panel_type=wall&position=1&wall_number=5&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=D&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=3225.60&notes=
```

### Панель #1 (id=92, стена 6) — с отделкой, notes=test
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-92&panel_type=wall&position=1&wall_number=6&quantity=1&height=651.50&width=774.50&area=0.50&joint_left=DG&joint_right=DH&joint_top=DG&joint_bottom=H&finish_group=%D0%A8%D0%9F%D0%9E%D0%9D&finish=American+walnut&veneer_direction=%D0%93%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%BD%D1%82%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=3166.05&notes=test
```

### Панель #1 (id=93, стена 7)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-93&panel_type=wall&position=1&wall_number=7&quantity=1&height=643.00&width=791.50&area=0.51&joint_left=G&joint_right=G&joint_top=DG&joint_bottom=G&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2216.05&notes=
```

### Панель #2 (id=78, стена 1)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-78&panel_type=wall&position=2&wall_number=1&quantity=1&height=2688.00&width=983.50&area=2.64&joint_left=C&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2688.00&notes=
```

### Панель #2 (id=81, стена 2)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-81&panel_type=wall&position=2&wall_number=2&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2688.00&notes=
```

### Панель #2 (id=84, стена 3) — с отделкой и алюминием
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-84&panel_type=wall&position=2&wall_number=3&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=C&joint_top=D&joint_bottom=DG&finish_group=%D0%A8%D0%9F%D0%9E%D0%9D&finish=Dark+Grey+Oak&veneer_direction=%D0%93%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%BD%D1%82%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5&decor_name=Dark+Grey+Oak+5+%D0%BC%D0%BC&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=Dark+brown+Colour+2K&markup_percent=10.00&cost=10855.86&notes=
```

### Панель #2 (id=87, стена 4)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-87&panel_type=wall&position=2&wall_number=4&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2688.00&notes=
```

### Панель #2 (id=90, стена 5)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-90&panel_type=wall&position=2&wall_number=5&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=C&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2688.00&notes=
```

### Панель #3 (id=79, стена 1)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-79&panel_type=wall&position=3&wall_number=1&quantity=1&height=2688.00&width=983.50&area=2.64&joint_left=C&joint_right=FR&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=1344.00&notes=
```

### Панель #3 (id=82, стена 2)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-82&panel_type=wall&position=3&wall_number=2&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=D&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=3225.60&notes=
```

### Панель #3 (id=85, стена 3) — с отделкой и алюминием
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-85&panel_type=wall&position=3&wall_number=3&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=A&joint_top=D&joint_bottom=DG&finish_group=%D0%A8%D0%9F%D0%9E%D0%9D&finish=Dark+Grey+Oak&veneer_direction=%D0%93%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%BD%D1%82%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5&decor_name=Dark+Grey+Oak+5+%D0%BC%D0%BC&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=Dark+brown+Colour+2K&markup_percent=10.00&cost=10452.66&notes=
```

### Панель #3 (id=88, стена 4)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-88&panel_type=wall&position=3&wall_number=4&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=D&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=3225.60&notes=
```

### Панель #3 (id=91, стена 5)
```
token=<TOKEN>&id_person=<id_person>&source=nuovo60&order_id=4&order_number=6476157675676716716576176716716&invoice_number=34567897654636789087564&customer_name=123456789&agent_name=12345&counterparty=23456&city=%D0%98%D0%B6%D0%B5%D0%B2%D1%81%D0%BA&external_id=panel-91&panel_type=wall&position=3&wall_number=5&quantity=1&height=2688.00&width=999.00&area=2.69&joint_left=C&joint_right=A&joint_top=&joint_bottom=&finish_group=&finish=&veneer_direction=&decor_name=&aluminum_vertical_count=0&aluminum_horizontal_count=0&aluminum_color=&markup_percent=0.00&cost=2284.80&notes=
```

---

## Вопросы к вашей стороне

1. Почему `addPanel` возвращает **пустое тело**? Какого поля не хватает / что не так?
2. Нужна ли активная сессия `PHPSESSID` от `login/`, или достаточно `id_person` в теле?
3. Какой ожидается набор и имена полей у `addPanel` и что он возвращает при успехе (ключ с `id_panel`)?
