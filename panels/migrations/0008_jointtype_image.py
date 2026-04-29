from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('panels', '0007_add_decor_aluminum_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='jointtype',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='joints/', verbose_name='Фото узла'),
        ),
    ]
