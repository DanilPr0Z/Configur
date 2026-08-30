"""Убирает следы старых импортов каталога отделок (серия 60) и профилей.

Эти позиции остались от прежних версий Excel: дубли с другими названиями
(«Avorio» рядом с «Avorio LACATO»), группы «ШПОН 5ММ» / «ШПОН 2.5ММ» /
«GLOSS», которых в актуальном файле нет. Цены у них были посчитаны по старым
правилам, поэтому на сайте выбор такой отделки давал непонятную сумму.

Отделки, на которые ссылаются панели существующих заказов, не трогаем.

Алюминиевые профили чистим целиком: их пересоздаёт `loaddata catalog.json`
сразу после миграций, а старые строки лежат под другими PK и иначе остались бы
в спецификации дублями со старыми (закупочными) ценами.
"""
from django.db import migrations

LEGACY = [
    ('60', 'FRASSINO', ['Avorio', 'Avorio old', 'Bianco', 'Bianco Night',
                        'Bianco Night old', 'Bianco old', 'Cappuccino',
                        'Cappuccino old', 'Cioccolato', 'Cioccolato old',
                        'Grigio', 'Grigio Chiaro', 'Grigio Chiaro old',
                        'Grigio old', 'Nero', 'Nero old']),
    ('60', 'GLOSS', ['Gloss']),
    ('60', 'LACATO', ['Avorio', 'Bianco', 'Bianco Night', 'Cappuccino',
                      'Cioccolato', 'Grigio', 'Grigio Chiaro', 'Nero']),
    ('60', 'STONE', ['2000 S', '3324', '3329', '3347', '3349', '3355', '3382',
                     '3416', '3445', '3446', '3447', '3449', '3450',
                     'Ciliegia avollo 4604', 'Noce savoia 4605']),
    ('60', 'ШПОН 2.5ММ', ['Frassino OLD', 'Noce Europeo', 'Rovere Europeo']),
    ('60', 'ШПОН 5ММ', ['Frassino', 'Rovere Country', 'Rovere Europeo']),
]


def prune(apps, schema_editor):
    Finish = apps.get_model('panels', 'Finish')
    FinishGroup = apps.get_model('panels', 'FinishGroup')
    Panel = apps.get_model('panels', 'Panel')
    DoorPanel = apps.get_model('panels', 'DoorPanel')

    used = (set(Panel.objects.exclude(finish=None).values_list('finish_id', flat=True))
            | set(DoorPanel.objects.exclude(finish=None).values_list('finish_id', flat=True)))

    for series, group_name, names in LEGACY:
        Finish.objects.filter(
            group__series=series, group__name=group_name, name__in=names,
        ).exclude(id__in=used).delete()

    for group in FinishGroup.objects.filter(series='60',
                                            name__in=['GLOSS', 'ШПОН 5ММ', 'ШПОН 2.5ММ']):
        if not Finish.objects.filter(group=group).exists():
            group.delete()

    apps.get_model('panels', 'AluminumProfile').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [('panels', '0013_framingmodel_has_shadow_framingmodel_has_veneer_and_more')]

    operations = [migrations.RunPython(prune, migrations.RunPython.noop)]
