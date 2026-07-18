from rest_framework.permissions import BasePermission, SAFE_METHODS


class RequireCascateLogin(BasePermission):
    """Чтение открыто, запись (создание/изменение/удаление заказов и панелей)
    требует входа через cascate.ru.

    Фронт после успешного входа кладёт id_person в localStorage и присылает его
    в заголовке X-Cascate-Id на каждом запросе (axios-интерцептор). Наличие
    непустого id_person = пользователь вошёл в cascate.ru.
    """
    message = 'Войдите через cascate.ru, чтобы сохранять заказы.'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool((request.headers.get('X-Cascate-Id') or '').strip())
