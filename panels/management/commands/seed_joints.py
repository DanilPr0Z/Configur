from django.core.management.base import BaseCommand
from panels.models import JointType

JOINTS = [
    {"code": "A",  "name": "Торцевой финишный профиль",           "offset_mm": -15.0,  "price_per_meter": 350.0, "profile_article": "104.256",   "profile_count": 1.0},
    {"code": "B",  "name": "Ламель соединительная",               "offset_mm":   0.0,  "price_per_meter": 350.0, "profile_article": "ХДФ 3,2 ММ","profile_count": 0.5},
    {"code": "C",  "name": "Соединительный профиль",              "offset_mm":  -4.0,  "price_per_meter": 500.0, "profile_article": "104.259",   "profile_count": 0.5},
    {"code": "D",  "name": "Угловой профиль (тип D)",             "offset_mm":  19.4,  "price_per_meter": 700.0, "profile_article": "104.270",   "profile_count": 0.5},
    {"code": "DG", "name": "Угловой профиль DG",                  "offset_mm":  51.9,  "price_per_meter": 700.0, "profile_article": "104.270",   "profile_count": 0.5},
    {"code": "DH", "name": "Угловой профиль DH",                  "offset_mm":  43.5,  "price_per_meter": 700.0, "profile_article": "104.270",   "profile_count": 0.5},
    {"code": "E",  "name": "Тип E",                               "offset_mm":  26.0,  "price_per_meter": 350.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "FL", "name": "Торцевой финишный профиль (левый)",   "offset_mm": -15.0,  "price_per_meter":   0.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "FR", "name": "Торцевой финишный профиль (правый)",  "offset_mm": -26.0,  "price_per_meter":   0.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "G",  "name": "Ламель стыковочная 43 мм (тип G)",   "offset_mm":  43.0,  "price_per_meter": 800.0, "profile_article": "ХДФ 3,2 ММ","profile_count": 0.0},
    {"code": "H",  "name": "Ламель стыковочная 51,5 мм (тип H)", "offset_mm":  51.5,  "price_per_meter": 800.0, "profile_article": "ХДФ 3,2 ММ","profile_count": 0.0},
    {"code": "I",  "name": "Тип I",                               "offset_mm":  -1.2,  "price_per_meter": 350.0, "profile_article": "104.256",   "profile_count": 0.0},
    {"code": "J",  "name": "Тип J",                               "offset_mm":   0.0,  "price_per_meter":   0.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "K",  "name": "Тип K",                               "offset_mm":   0.0,  "price_per_meter":   0.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "O",  "name": "Тип O",                               "offset_mm": -27.1,  "price_per_meter":   0.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "P",  "name": "Декоративная фрезеровка (узел P)",    "offset_mm":  -6.0,  "price_per_meter": 500.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "R",  "name": "Фрезеровка декора (узел R)",          "offset_mm":  -6.0,  "price_per_meter": 350.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "S",  "name": "Тип S",                               "offset_mm":   0.0,  "price_per_meter": 600.0, "profile_article": "",          "profile_count": 0.0},
    {"code": "T",  "name": "Тип T",                               "offset_mm":   0.0,  "price_per_meter": 700.0, "profile_article": "",          "profile_count": 0.0},
]


class Command(BaseCommand):
    help = "Создать/обновить узлы JointType (не затрагивает поле image)"

    def handle(self, *args, **options):
        created = updated = 0
        for data in JOINTS:
            obj, is_new = JointType.objects.get_or_create(
                code=data["code"],
                defaults=data,
            )
            if not is_new:
                for field, value in data.items():
                    setattr(obj, field, value)
                obj.save(update_fields=list(data.keys()))
                updated += 1
            else:
                created += 1
        self.stdout.write(self.style.SUCCESS(
            f"Готово: создано {created}, обновлено {updated} узлов."
        ))
