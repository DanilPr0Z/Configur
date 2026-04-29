from django.db import models


class JointType(models.Model):
    """Тип узла (A, B, C, D, DG, DH, G, H, E, FL, FR, P, R, I, O, S, T)"""
    code = models.CharField(max_length=10, unique=True, verbose_name='Код узла')
    name = models.CharField(max_length=200, blank=True, verbose_name='Название')
    offset_mm = models.FloatField(default=0, verbose_name='Поправка к ширине, мм')
    price_per_meter = models.FloatField(default=0, verbose_name='Цена обработки руб/пм')
    profile_article = models.CharField(max_length=50, blank=True, verbose_name='Артикул профиля')
    profile_count = models.FloatField(default=0, verbose_name='Кол-во профилей на 1 узел')
    image = models.ImageField(upload_to='joints/', blank=True, null=True, verbose_name='Фото узла')

    class Meta:
        verbose_name = 'Тип узла'
        verbose_name_plural = 'Типы узлов'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.name}' if self.name else self.code


class FinishGroup(models.Model):
    """Группа отделки: ШПОН, STONE, LACATO, FONDO, GLOSS, FRASSINO, ШПОН 5ММ, ШПОН 2.5ММ"""
    name = models.CharField(max_length=100, unique=True, verbose_name='Название группы')
    sort_order = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Группа отделки'
        verbose_name_plural = 'Группы отделок'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Finish(models.Model):
    """Конкретная отделка с ценой за кв.м"""
    group = models.ForeignKey(FinishGroup, on_delete=models.CASCADE,
                              related_name='finishes', verbose_name='Группа')
    name = models.CharField(max_length=200, verbose_name='Название отделки')
    price_sqm = models.FloatField(verbose_name='Цена руб/кв.м')
    decor_name = models.CharField(max_length=300, blank=True,
                                  verbose_name='Наименование декора 3D по умолчанию')

    class Meta:
        verbose_name = 'Отделка'
        verbose_name_plural = 'Отделки'
        ordering = ['group', 'name']

    def __str__(self):
        return f'{self.group.name} / {self.name}'


class ProfileColor(models.Model):
    """Цвет алюминиевого профиля"""
    name = models.CharField(max_length=200, unique=True, verbose_name='Название цвета')
    sort_order = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Цвет профиля'
        verbose_name_plural = 'Цвета профилей'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class AluminumProfile(models.Model):
    """Алюминиевый профиль (для автоподбора в спецификации)"""
    article = models.CharField(max_length=50, verbose_name='Артикул')
    name = models.CharField(max_length=200, verbose_name='Название')
    length_mm = models.IntegerField(verbose_name='Длина, мм')
    price_per_piece = models.FloatField(verbose_name='Цена за шт, руб')
    joint_type_code = models.CharField(max_length=10, blank=True,
                                       verbose_name='Код узла (для автосчёта)')
    count_per_joint = models.FloatField(default=1,
                                        verbose_name='Кол-во профилей на 1 узел')
    note = models.TextField(blank=True, verbose_name='Примечание')

    class Meta:
        verbose_name = 'Профиль алюминиевый'
        verbose_name_plural = 'Профили алюминиевые'

    def __str__(self):
        return f'{self.article} — {self.name}'


# ─── Заказ ───────────────────────────────────────────────────────────────────

class Order(models.Model):
    """Заказ стеновых панелей"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    customer_name = models.CharField(max_length=300, blank=True, verbose_name='ФИО заказчика')
    agent_name = models.CharField(max_length=300, blank=True, verbose_name='ФИО агента')
    counterparty = models.CharField(max_length=300, blank=True, verbose_name='Контрагент')
    order_number = models.CharField(max_length=100, blank=True, verbose_name='Номер заказа')
    invoice_number = models.CharField(max_length=100, blank=True, verbose_name='Номер счёта')
    order_date = models.DateField(null=True, blank=True, verbose_name='Дата принятия заказа')
    city = models.CharField(max_length=200, blank=True, verbose_name='Город')
    notes = models.TextField(blank=True, verbose_name='Примечания')
    configurator_state = models.JSONField(null=True, blank=True, verbose_name='Состояние конфигуратора')

    class Meta:
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-created_at']

    def __str__(self):
        return f'Заказ #{self.order_number or self.pk} — {self.customer_name}'


class DoorPanel(models.Model):
    """Панель над дверным проёмом"""
    MOUNT_CHOICES = [('ceiling', 'В потолок'), ('opening', 'В проём')]
    OPENING_CHOICES = [('in', 'Внутрь'), ('out', 'Наружу')]

    order = models.ForeignKey(Order, on_delete=models.CASCADE,
                              related_name='door_panels', verbose_name='Заказ')
    position = models.IntegerField(default=1, verbose_name='Порядковый №')
    wall_number = models.CharField(max_length=50, default='1', verbose_name='Номер стены')

    door_order_number = models.CharField(max_length=100, blank=True,
                                         verbose_name='№ заказа дверного полотна из DGV')
    opening_width = models.FloatField(default=0, verbose_name='Ширина проёма L, мм')
    opening_height = models.FloatField(default=0, verbose_name='Высота проёма H, мм')
    ceiling_height = models.FloatField(default=0, verbose_name='Высота потолка, мм')
    mount_type = models.CharField(max_length=20, choices=MOUNT_CHOICES,
                                  default='ceiling', verbose_name='Тип монтажа двери')
    opening_direction = models.CharField(max_length=10, choices=OPENING_CHOICES,
                                         default='in', verbose_name='Открывание двери')

    # Узлы соединения с соседними панелями
    joint_top_left = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='+',
                                       verbose_name='Узел соединения панелей над дверью (левый)')
    joint_top_right = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='+',
                                        verbose_name='Узел соединения панелей над дверью (правый)')
    joint_bottom = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='+',
                                     verbose_name='Узел соединения с дверной коробкой (нижний)')

    # Кромки самой панели
    edge_left = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='+', verbose_name='Кромка левая')
    edge_right = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='+', verbose_name='Кромка правая')
    edge_top = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='+', verbose_name='Кромка верхняя')
    edge_bottom = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='+', verbose_name='Кромка нижняя')

    quantity = models.IntegerField(default=1, verbose_name='Количество, шт')
    panel_height = models.FloatField(default=0, verbose_name='Высота панели над дверью, мм')
    panel_width = models.FloatField(default=0, verbose_name='Ширина панели над дверью, мм')

    finish_group = models.ForeignKey(FinishGroup, on_delete=models.SET_NULL,
                                     null=True, blank=True, verbose_name='Группа отделок')
    finish = models.ForeignKey(Finish, on_delete=models.SET_NULL,
                               null=True, blank=True, verbose_name='Отделка')
    veneer_direction = models.CharField(max_length=100, blank=True, verbose_name='Направление шпона')
    decor_name = models.CharField(max_length=300, blank=True, verbose_name='Наименование декора 3D')
    markup_percent = models.FloatField(default=0, verbose_name='Наценка, %')
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Панель над дверью'
        verbose_name_plural = 'Панели над дверями'
        ordering = ['order', 'position']

    def __str__(self):
        return f'Дверная панель #{self.position} (заказ {self.order_id})'

    @property
    def area_sqm(self):
        if self.panel_height <= 0 or self.panel_width <= 0:
            return 0
        area = self.panel_height * self.panel_width / 1_000_000
        return max(area, 0.5) * self.quantity

    @property
    def edge_side_cost(self):
        left = self.edge_left.price_per_meter if self.edge_left else 0
        right = self.edge_right.price_per_meter if self.edge_right else 0
        return (left + right) * self.panel_height * 0.001 * self.quantity

    @property
    def edge_top_bottom_cost(self):
        top = self.edge_top.price_per_meter if self.edge_top else 0
        bottom = self.edge_bottom.price_per_meter if self.edge_bottom else 0
        return (top + bottom) * self.panel_width * 0.001 * self.quantity

    @property
    def finish_cost(self):
        if not self.finish:
            return 0
        base = self.finish.price_sqm * self.area_sqm
        return base * (1 + self.markup_percent / 100)

    @property
    def total_cost(self):
        return self.finish_cost + self.edge_side_cost + self.edge_top_bottom_cost


class Panel(models.Model):
    """Стеновая панель в заказе"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE,
                              related_name='panels', verbose_name='Заказ')
    position = models.IntegerField(default=1, verbose_name='Порядковый №')
    wall_number = models.CharField(max_length=50, default='1', verbose_name='Номер стены')
    quantity = models.IntegerField(default=1, verbose_name='Количество, шт')

    height_mm = models.FloatField(default=0, verbose_name='Высота, мм')
    width_mm = models.FloatField(default=0, verbose_name='Ширина, мм')

    joint_left = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='+', verbose_name='Тип узла — левый край')
    joint_right = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='+', verbose_name='Тип узла — правый край')
    joint_top = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='+', verbose_name='Тип узла — верх')
    joint_bottom = models.ForeignKey(JointType, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='+', verbose_name='Тип узла — низ')

    finish_group = models.ForeignKey(FinishGroup, on_delete=models.SET_NULL,
                                     null=True, blank=True, verbose_name='Группа отделок')
    finish = models.ForeignKey(Finish, on_delete=models.SET_NULL,
                               null=True, blank=True, verbose_name='Отделка')
    veneer_direction = models.CharField(max_length=100, blank=True,
                                        verbose_name='Направление шпона')
    decor_name = models.CharField(max_length=300, blank=True,
                                  verbose_name='Наименование декора 3D')

    aluminum_vertical_count = models.IntegerField(default=0,
                                                  verbose_name='Кол-во вертикального алюм. декора, шт')
    aluminum_horizontal_count = models.IntegerField(default=0,
                                                    verbose_name='Кол-во горизонтального алюм. декора, шт')
    aluminum_color = models.ForeignKey(ProfileColor, on_delete=models.SET_NULL,
                                       null=True, blank=True, verbose_name='Цвет алюм. декора')

    markup_percent = models.FloatField(default=0, verbose_name='Наценка, %')
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Стеновая панель'
        verbose_name_plural = 'Стеновые панели'
        ordering = ['order', 'position']

    def __str__(self):
        return f'Панель #{self.position} {self.height_mm}×{self.width_mm} (заказ {self.order_id})'

    @property
    def area_sqm(self):
        if self.height_mm <= 0 or self.width_mm <= 0 or self.quantity <= 0:
            return 0
        area_per_panel = self.height_mm * self.width_mm / 1_000_000
        return max(area_per_panel, 0.5) * self.quantity

    @property
    def joint_side_cost(self):
        left_price = self.joint_left.price_per_meter if self.joint_left else 0
        right_price = self.joint_right.price_per_meter if self.joint_right else 0
        return (left_price + right_price) * self.height_mm * 0.001 * self.quantity

    @property
    def joint_top_bottom_cost(self):
        top_price = self.joint_top.price_per_meter if self.joint_top else 0
        bottom_price = self.joint_bottom.price_per_meter if self.joint_bottom else 0
        return (top_price + bottom_price) * self.width_mm * 0.001 * self.quantity

    @property
    def finish_cost(self):
        if not self.finish:
            return 0
        base = self.finish.price_sqm * self.area_sqm
        return base * (1 + self.markup_percent / 100)

    @property
    def total_cost(self):
        return self.finish_cost + self.joint_side_cost + self.joint_top_bottom_cost
