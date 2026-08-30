"""Приводит группы отделок к тому, как они заданы в Excel.

В файле состав группы задан именованным диапазоном («ГРУППА ОТДЕЛОК» →
`INDIRECT(<группа>)`), а загрузчик раньше угадывал группу по названию отделки.
Из-за этого HPL «под дерево» уезжали в выдуманную WOOD, камни — в STONE,
«(PELLE)» — в КОЖУ, хотя в файле все они входят в КОМПОЗИТ; «* FRASSINO OLD» —
часть FRASSINO. Об этом же писал Виталий: «в Wood у вас зачем-то отдельно
выведены hpl в цвете под дерево».

Отделки переносятся вместе с PK, поэтому панели оформленных заказов
не теряют отделку. Опустевшие группы удаляются.
"""
from django.db import migrations

# группа-источник -> группа-приёмник
MERGE_GROUPS = {
    'STONE': 'КОМПОЗИТ',
    'WOOD': 'КОМПОЗИТ',
    'FRASSINO OLD': 'FRASSINO',
}

# отдельные отделки, ушедшие в КОЖУ по «(PELLE)» в названии
FROM_LEATHER = ['3299 (PELLE)', '3153(PELLE)', '3156(PELLE)', '3240(PELLE)', '5679']


def regroup(apps, schema_editor):
    FinishGroup = apps.get_model('panels', 'FinishGroup')
    Finish = apps.get_model('panels', 'Finish')

    def move(finishes, series, target_name):
        target = FinishGroup.objects.filter(series=series, name=target_name).first()
        if target is None:
            return
        for f in finishes:
            if f.group_id == target.id:
                continue
            if Finish.objects.filter(group=target, name=f.name).exists():
                continue  # такое имя в приёмнике уже есть — не плодим дубль
            f.group = target
            f.save(update_fields=['group'])

    for series in ('50', '60'):
        for src_name, dst_name in MERGE_GROUPS.items():
            src = FinishGroup.objects.filter(series=series, name=src_name).first()
            if src:
                move(list(Finish.objects.filter(group=src)), series, dst_name)

        leather = FinishGroup.objects.filter(series=series, name='КОЖА').first()
        if leather:
            move(list(Finish.objects.filter(group=leather, name__in=FROM_LEATHER)),
                 series, 'КОМПОЗИТ')

    for group in FinishGroup.objects.filter(name__in=list(MERGE_GROUPS)):
        if not Finish.objects.filter(group=group).exists():
            group.delete()


class Migration(migrations.Migration):

    dependencies = [('panels', '0014_prune_legacy_finishes')]

    operations = [migrations.RunPython(regroup, migrations.RunPython.noop)]
