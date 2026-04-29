from django.db import migrations


def add_decor_aluminum(apps, schema_editor):
    AluminumProfile = apps.get_model('panels', 'AluminumProfile')
    AluminumProfile.objects.get_or_create(
        article='П 6x6',
        defaults={
            'name': 'Алюминиевый декоративный профиль П 6×6',
            'length_mm': 2995,
            'price_per_piece': 0,
            'joint_type_code': 'decor',
            'count_per_joint': 1,
            'note': 'Декоративный вертикальный/горизонтальный вставной профиль. Укажите цену в разделе администрирования.',
        }
    )


def remove_decor_aluminum(apps, schema_editor):
    AluminumProfile = apps.get_model('panels', 'AluminumProfile')
    AluminumProfile.objects.filter(article='П 6x6').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('panels', '0006_fix_decor_per_finish'),
    ]

    operations = [
        migrations.RunPython(add_decor_aluminum, remove_decor_aluminum),
    ]
