from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import BasePermission

# Сколько живёт сессия без активности
SESSION_TTL = timedelta(days=30)


def cascate_id(request) -> str:
    """id_person вошедшего пользователя (пусто — не вошёл).

    Узнаём его по токену сессии из заголовка X-Cascate-Token, который фронт
    получает при входе. Сам id_person из запроса не принимаем: он не секрет,
    и по нему можно было бы выдать себя за другого.
    """
    cached = getattr(request, '_cascate_id', None)
    if cached is not None:
        return cached

    from .models import CascateSession   # модели импортируем лениво: permissions грузится раньше

    token = (request.headers.get('X-Cascate-Token') or '').strip()
    id_person = ''
    if token:
        session = CascateSession.objects.filter(token=token).first()
        if session:
            if timezone.now() - session.last_seen > SESSION_TTL:
                session.delete()
            else:
                id_person = session.id_person
                session.save(update_fields=['last_seen'])
    request._cascate_id = id_person
    return id_person


class RequireCascateLogin(BasePermission):
    """Весь API — только для вошедших через cascate.ru, и на чтение, и на запись.
    Свои заказы и заявки каждый видит через фильтр в get_queryset вьюсета.
    """
    message = 'Войдите через cascate.ru, чтобы пользоваться конфигуратором.'

    def has_permission(self, request, view):
        return bool(cascate_id(request))
