"""
Загрузка данных из Excel-файла NUOVO 60 в базу данных.
Запуск: python manage.py load_excel
"""

import os
import re
from django.core.management.base import BaseCommand
import openpyxl

from panels.models import (
    JointType, FinishGroup, Finish, ProfileColor, AluminumProfile,
    Panel, DoorPanel,
)

EXCEL_PATH = 'NUOVO 60. Расчет стеновых панелей (учет узлов) 26.11.2025.xlsx'

# Коды узлов
JOINT_CODES = {'A', 'B', 'C', 'D', 'DG', 'DH', 'E', 'FL', 'FR', 'G', 'H', 'I', 'J', 'K', 'O', 'P', 'R', 'S', 'T'}

# Ключ группы в Excel (колонка G листа «Отделки» = список для поля «ГРУППА
# ОТДЕЛОК») -> название группы у нас. Состав группы берётся из одноимённого
# именованного диапазона книги: в Excel список отделок задан как INDIRECT(<группа>).
GROUP_MAP = {
    'ШПОН': 'ШПОН',
    'FRASSINO': 'FRASSINO',
    'КОМПОЗИТ': 'КОМПОЗИТ',
    'LACATO': 'LACATO',
    'ЛДСП': 'ЛДСП',
    'КОЖА': 'КОЖА',
    'FONDO': 'FONDO',
    'MIRROR': 'MIRROR',
    'COLOUR_GLASS': 'COLOUR GLASS',
    'COLOUR_GLASS_MAT': 'COLOUR GLASS MAT',
    'COLOUR_GLASS_U.W': 'COLOUR GLASS 8W',
    'COLOUR_GLASS_MAT_U.W': 'COLOUR GLASS MAT 8W',
    'ШПОН_5_ММ': 'ШПОН 5 ММ',
    'ШПОН_2.5_ММ': 'ШПОН 2,5 ММ',
    'ШПОН_1.5_ММ': 'ШПОН 1,5 ММ',
    'LACATO_2.5_MM': 'LACATO 2,5 ММ',
}

# Список групп в колонке G листа «Отделки» — диапазон валидации поля
# «ГРУППА ОТДЕЛОК» (G23:G38); ниже по колонке идут посторонние подписи.
GROUP_LIST_ROW = 23
GROUP_LIST_LAST_ROW = 38

NON_COLOR_NAMES = {
    'Цвет профиля ', 'Группа отделок', 'ШПОН', 'STONE', 'LACATO',
    'FONDO', 'GLOSS', 'FRASSINO',
}


def norm_article(val):
    """Нормализует артикул профиля."""
    if val is None:
        return ''
    if isinstance(val, float):
        if abs(val - 104.256) < 0.001:
            return '104.256'
        if abs(val - 104.259) < 0.001:
            return '104.259'
        if abs(val - 104.27) < 0.001:
            return '104.270'
        return str(val)
    return str(val).strip()


def defined_range_rows(wb, key):
    """Строки листа «Отделки» для именованного диапазона группы.

    «Отделки!$B$24:$B$56» -> (24, 56); «Отделки!$B$179» -> (179, 179).
    """
    dn = wb.defined_names.get(key)
    if dn is None:
        return None
    m = re.search(r'\$B\$(\d+)(?::\$B\$(\d+))?', str(dn.value))
    if not m:
        return None
    first = int(m.group(1))
    return first, int(m.group(2) or first)


class Command(BaseCommand):
    help = 'Загружает данные из Excel-файла NUOVO 60/50 в базу данных'

    def add_arguments(self, parser):
        parser.add_argument('--series', default='60', choices=['50', '60'],
                            help='Серия (по умолчанию 60)')
        parser.add_argument('--file', default=EXCEL_PATH,
                            help='Путь к Excel-файлу')
        parser.add_argument('--skip-shared', action='store_true',
                            help='Не грузить общие справочники (цвета, алюминий)')
        parser.add_argument('--prune', action='store_true',
                            help='Удалить отделки серии, которых нет в Excel '
                                 '(кроме используемых в заказах)')

    def handle(self, *args, **options):
        self.series = options['series']
        self.prune = options['prune']
        path = options['file']
        if not os.path.exists(path):
            self.stderr.write(f'Файл не найден: {path}')
            return

        self.stdout.write(f'Открываю Excel (серия {self.series}): {path}')
        wb = openpyxl.load_workbook(path, data_only=True)

        self._load_joint_types(wb)
        self._load_finishes(wb)
        if not options['skip_shared']:
            self._load_profile_colors(wb)
            self._load_aluminum_profiles(wb)

        self.stdout.write(self.style.SUCCESS(f'\n✓ Загрузка серии {self.series} завершена!'))

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Типы узлов — лист DATA
    # ──────────────────────────────────────────────────────────────────────────
    def _load_joint_types(self, wb):
        self.stdout.write('\n--- Типы узлов ---')
        ws = wb['DATA']

        # Собираем данные по узлам: код -> (offset, count, article, price)
        # Данные: idx3=код, idx4=offset, idx5=кол-во, idx6=артикул, idx7=цена
        joint_map = {}
        for row in ws.iter_rows(values_only=True):
            code = row[3] if len(row) > 3 else None
            if not isinstance(code, str):
                continue
            code = code.strip()
            if code not in JOINT_CODES:
                continue

            offset = float(row[4]) if isinstance(row[4], (int, float)) else 0.0
            count = float(row[5]) if isinstance(row[5], (int, float)) else 0.0
            article = norm_article(row[6]) if len(row) > 6 else ''
            price = float(row[7]) if len(row) > 7 and isinstance(row[7], (int, float)) else 0.0

            # Если код уже есть — обновляем только если новая запись богаче
            if code not in joint_map:
                joint_map[code] = (offset, count, article, price)
            else:
                old = joint_map[code]
                # Берём запись с ценой, либо с большим количеством данных
                if price > old[3] or (price == old[3] and article and not old[2]):
                    joint_map[code] = (offset, count, article, price)

        # Описания узлов
        labels = {
            'A': 'Торцевой (финиш)',
            'B': 'Ламель (соединение)',
            'C': 'Соединительный',
            'D': 'Угол наружный 90°',
            'DG': 'Угол внутренний G',
            'DH': 'Угол внутренний H',
            'E': 'Торцевой (+26 мм)',
            'FL': 'Финишный левый',
            'FR': 'Финишный правый',
            'G': 'Тип G (дверь, наружу)',
            'H': 'Тип H (дверь, внутрь)',
            'I': 'Тип I',
            'J': 'Тип J',
            'K': 'Тип K',
            'O': 'Без профиля',
            'P': 'Декор',
            'R': 'Подрез',
            'S': 'Стык',
            'T': 'Тип T',
        }

        created = updated = 0
        for code, (offset, count, article, price) in joint_map.items():
            obj, is_new = JointType.objects.update_or_create(
                code=code,
                series=self.series,
                defaults=dict(
                    name=labels.get(code, ''),
                    offset_mm=offset,
                    profile_count=count,
                    profile_article=article,
                    price_per_meter=price,
                ),
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(f'  Создано: {created}, обновлено: {updated}')
        for code, (offset, count, article, price) in sorted(joint_map.items()):
            self.stdout.write(f'  {code:4s}  offset={offset:>7.1f}  цена={price:>5.0f} руб/пм  профиль={article}')

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Цвета профилей — лист DATA
    # ──────────────────────────────────────────────────────────────────────────
    def _load_profile_colors(self, wb):
        self.stdout.write('\n--- Цвета профилей ---')
        ws = wb['DATA']

        colors = []
        reached_groups = False
        for row in ws.iter_rows(values_only=True):
            val = row[1] if len(row) > 1 else None
            if not isinstance(val, str):
                continue
            val_stripped = val.strip()
            if val_stripped == 'Группа отделок':
                reached_groups = True
                break
            if val_stripped in NON_COLOR_NAMES or not val_stripped:
                continue
            colors.append(val_stripped)

        created = updated = 0
        for i, name in enumerate(colors):
            _, is_new = ProfileColor.objects.update_or_create(
                name=name,
                defaults={'sort_order': i + 1},
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(f'  Создано: {created}, обновлено: {updated}  ({len(colors)} цветов)')

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Группы отделок и отделки — лист Отделки
    # ──────────────────────────────────────────────────────────────────────────
    def _load_finishes(self, wb):
        """Группы и отделки берём ровно так, как их видит Excel.

        Список групп — колонка G листа «Отделки» (диапазон валидации поля
        «ГРУППА ОТДЕЛОК»), состав каждой — одноимённый именованный диапазон
        книги, потому что список отделок в Excel задан как INDIRECT(<группа>).
        Раньше группа угадывалась по названию отделки, и каталог расходился с
        файлом: HPL «под дерево» уезжали в отдельную WOOD, камни — в STONE,
        «(PELLE)» — в КОЖУ, хотя все они входят в КОМПОЗИТ; «* FRASSINO OLD» —
        часть FRASSINO. Группы ЛДСП при этом не появлялось вовсе.
        """
        self.stdout.write('\n--- Отделки ---')
        ws = wb['Отделки']

        finish_count = 0
        seen_ids = set()
        group_counts = {}

        for i, row in enumerate(range(GROUP_LIST_ROW, GROUP_LIST_LAST_ROW + 1)):
            key_raw = ws.cell(row, 7).value
            if not isinstance(key_raw, str) or not key_raw.strip():
                continue
            key = key_raw.strip()
            group_name = GROUP_MAP.get(key)
            if not group_name:
                self.stdout.write(self.style.WARNING(f'  Группа {key!r} не в GROUP_MAP — пропуск'))
                continue
            rows = defined_range_rows(wb, key)
            if rows is None:
                self.stdout.write(self.style.WARNING(f'  Нет именованного диапазона {key!r} — пропуск'))
                continue

            group, _ = FinishGroup.objects.get_or_create(
                name=group_name, series=self.series,
                defaults={'sort_order': i + 1},
            )
            if group.sort_order != i + 1:
                group.sort_order = i + 1
                group.save(update_fields=['sort_order'])

            count = 0
            for r in range(rows[0], rows[1] + 1):
                name_raw = ws.cell(r, 2).value
                price = ws.cell(r, 5).value   # col E — ЦЕНА (розница)
                if name_raw is None or not isinstance(price, (int, float)):
                    continue
                name = str(name_raw).strip()
                if not name:
                    continue
                obj = self._move_or_create(group, name, round(float(price), 2))
                seen_ids.add(obj.id)
                count += 1
            group_counts[group_name] = count
            finish_count += count

        self.stdout.write(f'  Всего отделок загружено: {finish_count}')
        for g, cnt in group_counts.items():
            self.stdout.write(f'  {g}: {cnt} шт.')

        if self.prune:
            self._prune_finishes(seen_ids)

    def _move_or_create(self, group, name, price):
        """Отделка из другой группы той же серии переносится, а не создаётся заново.

        Важно для перегруппировки (STONE/WOOD -> КОМПОЗИТ и т.п.): у записи
        сохраняется PK, поэтому панели уже оформленных заказов не теряют отделку,
        а на сервере `loaddata` просто меняет ей группу.
        """
        existing = list(Finish.objects.filter(group__series=self.series, name=name))
        in_target = [f for f in existing if f.group_id == group.id]
        if not in_target and len(existing) == 1:
            moved = existing[0]
            self.stdout.write(f'  → {moved.group.name} / {name} → {group.name}')
            moved.group = group
            moved.price_sqm = price
            moved.save(update_fields=['group', 'price_sqm'])
            return moved
        obj, _ = Finish.objects.update_or_create(
            group=group, name=name, defaults={'price_sqm': price},
        )
        return obj

    def _prune_finishes(self, seen_ids):
        """Удаляет отделки серии, которых нет в Excel (следы старых импортов).

        Отделки, на которые ссылаются панели заказов, не трогаем — иначе у
        существующего заказа обнулится позиция. Пустые группы удаляем.
        """
        self.stdout.write('\n--- Чистка отделок, которых нет в Excel ---')
        stale = Finish.objects.filter(group__series=self.series).exclude(id__in=seen_ids)
        used_ids = (
            set(Panel.objects.exclude(finish=None).values_list('finish_id', flat=True))
            | set(DoorPanel.objects.exclude(finish=None).values_list('finish_id', flat=True))
        )
        kept = []
        removed = 0
        for f in stale.select_related('group'):
            if f.id in used_ids:
                kept.append(f'{f.group.name} / {f.name}')
                continue
            self.stdout.write(f'  − {f.group.name} / {f.name} ({f.price_sqm})')
            f.delete()
            removed += 1
        self.stdout.write(f'  Удалено: {removed}')
        if kept:
            self.stdout.write(self.style.WARNING(
                f'  Оставлены (используются в заказах): {", ".join(kept)}'))

        empty = [g for g in FinishGroup.objects.filter(series=self.series)
                 if not g.finishes.exists()]
        for g in empty:
            self.stdout.write(f'  − группа {g.name}')
            g.delete()

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Алюминиевые профили — по данным из Excel + логика узлов
    # ──────────────────────────────────────────────────────────────────────────
    def _load_aluminum_profiles(self, wb):
        self.stdout.write('\n--- Алюминиевые профили ---')

        # Лист «Отделки», блок цен профилей: L=артикул, M=«ЦЕНА ЗА 3000 мм» (розница,
        # = N × коэффициент J2), N=«Цена наша 3000 мм» (закупка). В спецификации
        # должна стоять розница, поэтому читаем колонку M (idx12), а не N.
        ws = wb['Отделки']
        profile_prices = {}  # excel-ключ -> розничная цена
        for row in ws.iter_rows(values_only=True):
            article_raw = row[11] if len(row) > 11 else None
            retail = row[12] if len(row) > 12 else None
            if article_raw is None:
                continue
            key = norm_article(article_raw)
            if key and isinstance(retail, (int, float)):
                profile_prices[key] = float(retail)

        self.stdout.write(f'  Цены профилей из Excel (розница): {profile_prices}')

        # Наши артикулы -> ключи в прайсе Excel
        EXCEL_KEY = {
            '104.256': '104.256',
            '104.259': '104.259',
            '104.270': '104.270',
            'ламель': 'ламель',
            'МДФ 10': 'навес',
            'П 6x6': '6*6*6',
        }

        # Список профилей: (article, name, length_mm, joint_type_code, count_per_joint, note)
        # Кол-во профилей на узел — колонка F листа DATA: у узла I она пустая,
        # профиль на него не добавляется (иначе ЛК считает дороже конфигуратора).
        profiles = [
            ('104.256', 'Торцевой профиль (финишный) Арт. 104.256', 3000, 'A', 1.0, ''),
            ('104.259', 'Соединительный профиль Арт. 104.259', 3000, 'C', 0.5, ''),
            ('104.270', 'Угловой профиль Арт. 104.270', 3000, 'D', 0.5, ''),
            ('104.270', 'Угловой профиль Арт. 104.270', 3000, 'DG', 0.5, ''),
            ('104.270', 'Угловой профиль Арт. 104.270', 3000, 'DH', 0.5, ''),
            ('ламель', 'Ламель соединительная (тип B)', 3000, 'B', 0.5, ''),
            ('МДФ 10', 'Навес стеновой панели', 900, '', 0.0, '4 шт на каждую панель'),
            ('П 6x6', 'Алюминиевый декоративный профиль П 6×6', 2995, 'decor', 1.0, ''),
        ]

        # Удаляем старые записи и создаём заново
        AluminumProfile.objects.all().delete()

        for article, name, length, joint_code, count, note in profiles:
            price = profile_prices.get(EXCEL_KEY[article], 0.0)

            AluminumProfile.objects.create(
                article=article,
                name=name,
                length_mm=length,
                price_per_piece=price,
                joint_type_code=joint_code,
                count_per_joint=count,
                note=note,
            )
            self.stdout.write(f'  {article:12s} / {joint_code:4s}  цена={price:.0f} руб/шт  ({name[:40]})')
