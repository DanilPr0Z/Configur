from rest_framework.permissions import BasePermission


def cascate_id(request) -> str:
    """id_person вошедшего пользователя из заголовка (пусто — не вошёл).

    Фронт после успешного входа кладёт id_person в localStorage и присылает его
    в заголовке X-Cascate-Id на каждом запросе (axios-интерцептор).
    """
    return (request.headers.get('X-Cascate-Id') or '').strip()


class RequireCascateLogin(BasePermission):
    """Весь API — только для вошедших через cascate.ru, и на чтение, и на запись.
    Свои заказы и заявки каждый видит через фильтр в get_queryset вьюсета.
    """
    message = 'Войдите через cascate.ru, чтобы пользоваться конфигуратором.'

    def has_permission(self, request, view):
        return bool(cascate_id(request))
