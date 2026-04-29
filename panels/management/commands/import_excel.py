"""
Management command: python manage.py import_excel
Импортирует справочные данные из Excel файла NUOVO 60 в базу данных:
- Типы узлов (JointType)
- Группы отделок и отделки (FinishGroup, Finish)
- Цвета профилей (ProfileColor)
- Алюминиевые профили (AluminumProfile)
"""

from django.core.management.base import BaseCommand
from panels.models import JointType, FinishGroup, Finish, ProfileColor, AluminumProfile


class Command(BaseCommand):
    help = 'Импорт справочных данных из Excel файла NUOVO 60'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='NUOVO 60. Расчет стеновых панелей (учет узлов) 26.11.2025.xlsx',
            help='Путь к Excel файлу',
        )

    def handle(self, *args, **options):
        self.stdout.write('Начинаем импорт данных...')
        self._import_joint_types()
        self._import_finishes()
        self._import_profile_colors()
        self._import_aluminum_profiles()
        self.stdout.write(self.style.SUCCESS('Импорт завершён успешно!'))

    def _import_joint_types(self):
        """Типы узлов из листа DATA (столбцы D-H строки 34-54)"""
        joint_data = [
            # code, name, offset_mm, price, profile_article, profile_count
            ('A', 'Торцевой финишный профиль', -15.0, 350.0, '104.256', 1.0),
            ('B', 'Ламель соединительная', 0.0, 350.0, 'ХДФ 3,2 ММ', 0.5),
            ('C', 'Соединительный профиль', -4.0, 500.0, '104.259', 0.5),
            ('D', 'Угловой профиль (тип D)', 19.4, 700.0, '104.270', 0.5),
            ('E', 'Тип E', 26.0, 350.0, '', 0.0),
            ('FL', 'Торцевой финишный профиль (левый)', -15.0, 0.0, '', 0.0),
            ('FR', 'Торцевой финишный профиль (правый)', -26.0, 0.0, '', 0.0),
            ('DG', 'Угловой профиль DG', 51.9, 700.0, '104.270', 0.5),
            ('DH', 'Угловой профиль DH', 43.5, 700.0, '104.270', 0.5),
            ('H', 'Ламель стыковочная 51,5 мм (тип H)', 58.5, 800.0, 'ХДФ 3,2 ММ', 0.0),
            ('G', 'Ламель стыковочная 43 мм (тип G)', 50.1, 800.0, 'ХДФ 3,2 ММ', 0.0),
            ('K', 'Тип K', 0.0, 0.0, '', 0.0),
            ('J', 'Тип J', 0.0, 0.0, '', 0.0),
            ('S', 'Тип S', 0.0, 600.0, '', 0.0),
            ('O', 'Тип O', -27.1, 0.0, '', 0.0),
            ('T', 'Тип T', 0.0, 700.0, '', 0.0),
            ('R', 'Фрезеровка декора (узел R)', -6.0, 350.0, '', 0.0),
            ('I', 'Тип I', -1.2, 350.0, '104.256', 0.0),
            ('P', 'Декоративная фрезеровка (узел P)', -6.0, 500.0, '', 0.0),
        ]

        created = 0
        for code, name, offset, price, article, count in joint_data:
            obj, is_new = JointType.objects.update_or_create(
                code=code,
                defaults=dict(
                    name=name,
                    offset_mm=offset,
                    price_per_meter=price,
                    profile_article=article,
                    profile_count=count,
                ),
            )
            if is_new:
                created += 1

        self.stdout.write(f'  Типы узлов: {JointType.objects.count()} записей ({created} новых)')

    def _import_finishes(self):
        """Отделки из листа Лист4 (столбцы A-F, строки 21+)"""
        # Данные извлечены из Excel: группа, название, цена кв.м (колонка E до 2750мм)
        finishes_data = [
            # (group_name, sort_order, [(finish_name, price_sqm), ...])
            ('ШПОН', 1, [
                ('Faggio', 25083.5),
                ('Noce Americano', 21228.32),
                ('Rovere Europeo', 17278.38),
                ('Noce Europeo', 16487.88),
                ('Rovere Country', 19570.40),
                ('Rovere Whisky', 16843.18),
                ('Ebano', 18493.88),
                ('Rovere Grigio', 16937.18),
                ('Rovere Cioccolato', 16937.18),
                ('Rovere Moca', 19317.23),
                ('Rovere Retro', 22295.30),
                ('Noce Europeo RAD', 18026.74),
            ]),
            ('ШПОН 5ММ', 2, [
                ('Rovere Country', 19570.40),
                ('Rovere Europeo', 17278.38),
                ('Frassino', 17278.38),
            ]),
            ('ШПОН 2.5ММ', 3, [
                ('Rovere Europeo', 17278.38),
                ('Noce Europeo', 16487.88),
                ('Frassino OLD', 17278.38),
            ]),
            ('STONE', 4, [
                ('3324', 10450.45),
                ('3329', 10450.45),
                ('3347', 10290.65),
                ('3349', 10450.45),
                ('3355', 10483.35),
                ('3382', 10450.45),
                ('3416', 10459.85),
                ('2000 S', 17528.65),
                ('3445', 10450.45),
                ('3446', 10450.45),
                ('3447', 10450.45),
                ('3449', 10295.35),
                ('3450', 10450.45),
                ('Noce savoia 4605', 10492.75),
                ('Ciliegia avollo 4604', 10483.35),
                ('Linen grigio 3318', 9858.25),
                ('Bronzo 3412', 10896.95),
                ('Rame FB 43', 10206.05),
            ]),
            ('LACATO', 5, [
                ('Nero', 7881.85),
                ('Bianco', 7581.05),
                ('Bianco Night', 7618.65),
                ('Grigio', 7618.65),
                ('Grigio Chiaro', 7552.85),
                ('Cioccolato', 7618.65),
                ('Cappuccino', 7590.45),
                ('Avorio', 7590.45),
            ]),
            ('FONDO', 6, [
                ('Fondo', 6659.85),
            ]),
            ('GLOSS', 7, [
                ('Gloss', 10046.25),
            ]),
            ('FRASSINO', 8, [
                ('Nero', 8912.42),
                ('Bianco', 8310.82),
                ('Bianco Night', 8386.02),
                ('Grigio', 8386.02),
                ('Grigio Chiaro', 8254.42),
                ('Cioccolato', 8386.02),
                ('Cappuccino', 8329.62),
                ('Avorio', 8329.62),
                ('Nero old', 7668.33),
                ('Bianco old', 7066.73),
                ('Bianco Night old', 7141.93),
                ('Grigio old', 7141.93),
                ('Grigio Chiaro old', 7010.33),
                ('Cioccolato old', 7141.93),
                ('Cappuccino old', 7085.53),
                ('Avorio old', 7085.53),
            ]),
        ]

        finish_count = 0
        for group_name, sort_order, items in finishes_data:
            group, _ = FinishGroup.objects.update_or_create(
                name=group_name,
                defaults={'sort_order': sort_order},
            )
            for finish_name, price in items:
                Finish.objects.update_or_create(
                    group=group,
                    name=finish_name,
                    defaults={'price_sqm': price},
                )
                finish_count += 1

        self.stdout.write(f'  Отделки: {Finish.objects.count()} записей')

    def _import_profile_colors(self):
        """Цвета алюминиевых профилей из листа DATA (столбец B строки 25-51)"""
        colors = [
            'Black sand 1K',
            'Champagne Colour 2K',
            'Titanium Matt Colour 2K',
            'Dark brown Colour 2K',
            'Black Matt Colour 2K',
            'White Matt Colour 2K',
            'Pearl Matt Colour 2K',
            'Gold matt Colour 2K',
            'Bronze Matt Colour 3K',
            'Chrome mat. 1K',
            'White sand 9003 1K',
            'Gold mat. 3K',
            'Champagne mat. 3K',
            'Gold 005 colour 2K',
            'Bonded 001 colour 2K',
            'Grafit 7016 colour 2K',
            'Cave colour',
            'Nomad colour',
            'Paladium Colour',
            'Marone Colour',
            'Gold 012 colour',
            'Avorio Colour',
            'Grafite Colour',
            'Corda Colour',
            'Ombra Colour',
            'Nikel Colour',
            'Copper Colour',
        ]

        for i, color in enumerate(colors):
            ProfileColor.objects.update_or_create(
                name=color,
                defaults={'sort_order': i},
            )

        self.stdout.write(f'  Цвета профилей: {ProfileColor.objects.count()} записей')

    def _import_aluminum_profiles(self):
        """Алюминиевые профили из листа "Ввод данных к заказу" (строки 182-198)"""
        # Цены из листа Отделки: 104.256=250, 104.259=250, 104.270=350, ламель=40, навес=200
        profiles_data = [
            # article, name, length_mm, price_per_piece, joint_type_code, count_per_joint, note
            ('104.256', 'Торцевой финишный профиль', 2995, 250.0, 'A', 1.0,
             'Считается поштучно кратно количеству выбранных узлов A'),
            ('104.259', 'Соединительный профиль', 2995, 250.0, 'C', 0.5,
             ''),
            ('104.270', 'Угловой профиль', 2995, 350.0, 'D', 0.5,
             ''),
            ('ХДФ 3.2 В', 'Ламель соединительная (тип B)', 2995, 40.0, 'B', 0.5,
             ''),
            ('ХДФ 3.2 H', 'Ламель стыковочная 51,5 мм (тип H)', 2000, 40.0, 'H', 1.0,
             ''),
            ('ХДФ 3.2 G', 'Ламель стыковочная 43 мм (тип G)', 2000, 40.0, 'G', 1.0,
             ''),
            ('МДФ 10', 'Навес стеновой панели', 900, 200.0, '', 4.0,
             'Считается из расчёта 4 шт на одну панель'),
            ('П 6x6', 'Профиль декор П-образный 6×6', 2995, 250.0, 'P', 1.0,
             'Считается кратно количеству фрезеровки декора узла P'),
        ]

        for article, name, length, price, joint_code, count_per, note in profiles_data:
            AluminumProfile.objects.update_or_create(
                article=article,
                defaults=dict(
                    name=name,
                    length_mm=length,
                    price_per_piece=price,
                    joint_type_code=joint_code,
                    count_per_joint=count_per,
                    note=note,
                ),
            )

        self.stdout.write(f'  Профили алюминиевые: {AluminumProfile.objects.count()} записей')
