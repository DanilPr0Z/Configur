"""
Заполнить справочник обрамления проёма из panels/framing_seed.json.

Идемпотентно (update_or_create): можно перезапускать. Цены, отредактированные
вручную в админке, будут перезаписаны значениями из JSON — для обновления
каталога правьте JSON и запускайте снова, для точечной правки цен правьте в БД.

Запуск: python manage.py seed_framing
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from panels.models import (
    FramingProfilePrice, FramingModel, FramingColor,
    FramingDoborGroup, FramingDobor,
)

SEED_FILE = Path(__file__).resolve().parents[2] / 'framing_seed.json'

# Категория цены профиля по названию модели (см. getPpu в framingData.ts)
def price_category(model_name):
    return {'MINI': 'mini', 'PASSO': 'passo', 'TRIANGLE': 'triangle'}.get(model_name, 'default')

# Группы, недоступные как вставка стекла/зеркала
NOT_GLASS = {'ПОД_АЛЮМИНИЙ'}
# Цена вставки: ШПОН — 360 ₽/м, остальные — 620 ₽/м (см. computeSpec)
def glass_price(group_name):
    return 360 if group_name == 'ШПОН' else 620


class Command(BaseCommand):
    help = 'Заполнить справочник обрамления проёма из framing_seed.json'

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(SEED_FILE.read_text(encoding='utf-8'))
        models_ = data['MODELS']
        colors = data['COLORS']
        dobs_groups = data['DOBS_GROUPS']
        dobs = data['DOBS']
        glass_extra = data['GLASS_EXTRA']

        # ── Цены профилей (одинаковы у всех цветов → берём из первого) ──
        p = colors[0]['p']  # [mini, passo, triangle, default]
        for cat, price in zip(('mini', 'passo', 'triangle', 'default'), p):
            FramingProfilePrice.objects.update_or_create(
                category=cat, defaults={'price_per_3000': price})

        # ── Модели ──
        for i, m in enumerate(models_):
            dc = m['dC']
            if dc == 'luna':
                mode, delta = 'luna', 0
            elif dc == 'cas':
                mode, delta = 'cas', 0
            else:
                mode, delta = 'fixed', dc
            FramingModel.objects.update_or_create(name=m['n'], defaults={
                'subtitle': m['t'], 'nH': m['nH'], 'nL': m['nL'],
                'dH': m['dH'], 'dL': m['dL'], 'depth_mode': mode, 'depth_delta': delta,
                'profile_count': m['pc'], 'has_glass': m['glass'],
                'price_category': price_category(m['n']), 'sort_order': i,
            })

        # ── Цвета ──
        for i, c in enumerate(colors):
            FramingColor.objects.update_or_create(name=c['n'], defaults={'sort_order': i})

        # ── Группы отделок доборов ──
        group_objs = {}
        for i, gname in enumerate(dobs_groups.keys()):
            obj, _ = FramingDoborGroup.objects.update_or_create(name=gname, defaults={
                'is_dobor': True, 'is_glass': gname not in NOT_GLASS,
                'glass_price_per_m': glass_price(gname), 'sort_order': i,
            })
            group_objs[gname] = obj
        # Группы только для вставки (стекло / зеркало)
        for j, gname in enumerate(glass_extra.keys()):
            obj, _ = FramingDoborGroup.objects.update_or_create(name=gname, defaults={
                'is_dobor': False, 'is_glass': True,
                'glass_price_per_m': glass_price(gname), 'sort_order': 100 + j,
            })
            group_objs[gname] = obj

        # ── Отделки доборов ──
        for gname, indices in dobs_groups.items():
            for order, idx in enumerate(indices):
                d = dobs[idx]
                FramingDobor.objects.update_or_create(
                    group=group_objs[gname], name=d['n'],
                    defaults={'price': d['p'], 'sort_order': order})
        # Вставки стекла / зеркала (цена берётся из группы, не из позиции)
        for gname, names in glass_extra.items():
            for order, n in enumerate(names):
                FramingDobor.objects.update_or_create(
                    group=group_objs[gname], name=n,
                    defaults={'price': 0, 'sort_order': order})

        self.stdout.write(self.style.SUCCESS(
            f'Обрамление засеяно: {FramingModel.objects.count()} моделей, '
            f'{FramingColor.objects.count()} цветов, '
            f'{FramingDoborGroup.objects.count()} групп, '
            f'{FramingDobor.objects.count()} отделок.'))
