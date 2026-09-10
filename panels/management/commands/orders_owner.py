"""Владельцы заказов: посмотреть и раздать.

Заказы, созданные до разделения по аккаунтам, лежат без владельца и видны всем
вошедшим. Этой командой их разбирают по кабинетам.

    python manage.py orders_owner --list
    python manage.py orders_owner --agent "Иванов И. И." --assign-to 777
    python manage.py orders_owner --all --assign-to 777
"""

from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from panels.models import FramingLead, Order


class Command(BaseCommand):
    help = 'Показать заказы без владельца и закрепить их за кабинетом cascate.ru'

    def add_arguments(self, parser):
        parser.add_argument('--list', action='store_true',
                            help='Только показать сводку, ничего не менять')
        parser.add_argument('--assign-to', metavar='ID_PERSON',
                            help='Кому отдать заказы (id_person из cascate.ru)')
        parser.add_argument('--agent', metavar='ФИО',
                            help='Отдать только заказы этого агента (точное совпадение)')
        parser.add_argument('--all', action='store_true',
                            help='Отдать все заказы без владельца')
        parser.add_argument('--leads', action='store_true',
                            help='То же самое для заявок обрамления')

    def handle(self, *args, **opts):
        model = FramingLead if opts['leads'] else Order
        what = 'заявок' if opts['leads'] else 'заказов'
        orphans = model.objects.filter(cascate_id_person='')

        if opts['list'] or not opts['assign_to']:
            owned = model.objects.exclude(cascate_id_person='').count()
            self.stdout.write(f'Всего {what}: {model.objects.count()}')
            self.stdout.write(f'  с владельцем: {owned}')
            self.stdout.write(f'  без владельца (видны всем): {orphans.count()}')
            if not opts['leads'] and orphans.exists():
                self.stdout.write('\nБез владельца по агентам:')
                for agent, n in Counter(
                    o.agent_name.strip() or '— не указан —' for o in orphans
                ).most_common():
                    self.stdout.write(f'  {n:>4}  {agent}')
            if not opts['assign_to']:
                self.stdout.write(self.style.WARNING(
                    '\nЧтобы закрепить: --assign-to <id_person> и --all или --agent "ФИО"'))
                return

        if not (opts['all'] or opts['agent']):
            raise CommandError('Укажите --all или --agent "ФИО" — что именно закрепить')

        qs = orphans
        if opts['agent']:
            qs = qs.filter(agent_name=opts['agent'])

        n = qs.update(cascate_id_person=opts['assign_to'])
        self.stdout.write(self.style.SUCCESS(
            f'Закреплено {what}: {n} → кабинет {opts["assign_to"]}'))
