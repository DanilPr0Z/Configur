from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('panels', '0005_add_door_edge_bottom_qty_markup'),
    ]

    operations = [
        # Убираем ошибочное поле decor_group с Panel
        migrations.RemoveField(
            model_name='panel',
            name='decor_group',
        ),
        # Добавляем decor_name на Finish (декор привязан к отделке, а не к группе)
        migrations.AddField(
            model_name='finish',
            name='decor_name',
            field=models.CharField(blank=True, max_length=300,
                                   verbose_name='Наименование декора 3D по умолчанию'),
        ),
    ]
