from django.db import migrations

# Узел TC «Теневой профиль» жил только в захардкоженном списке фронта: цены у
# него не было, а при сохранении заказа он превращался в «нет узла» и поправка
# высоты −12 мм терялась. Заводим его в справочнике обеих серий.
TC = dict(name='Теневой профиль', offset_mm=0, price_per_meter=0,
          profile_article='', profile_count=0)


def add_tc(apps, schema_editor):
    JointType = apps.get_model('panels', 'JointType')
    for series in ('60', '50'):
        JointType.objects.update_or_create(code='TC', series=series,
                                           defaults=dict(TC))


def drop_tc(apps, schema_editor):
    apps.get_model('panels', 'JointType').objects.filter(code='TC').delete()


class Migration(migrations.Migration):
    dependencies = [('panels', '0017_cascatesession')]
    operations = [migrations.RunPython(add_tc, drop_tc)]
