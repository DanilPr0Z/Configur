"""
Клиент внешнего API cascate.ru.

Особенности, выясненные экспериментально:
  * URL требует слеш в конце — иначе Apache отдаёт 301 и теряет POST-тело.
    Поэтому редиректы запрещены: молчаливый GET вместо POST хуже явной ошибки.
  * Бэкенд на PHP, тело — application/x-www-form-urlencoded, не JSON.
  * Сервер выдаёт PHPSESSID; держим Session, чтобы кука с login/ доехала
    до addPanel/ — вдруг он смотрит на сессию, а не только на id_person.

Формат ответа от программиста не получен, поэтому разбор терпимый:
ищем id в наборе вероятных ключей, при неудаче — падаем с телом ответа
в тексте ошибки, чтобы сразу было видно, что там на самом деле.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Ключи, под которыми может лежать идентификатор. Порядок = приоритет.
_PERSON_ID_KEYS = ('id_person', 'idPerson', 'person_id', 'personId', 'id')
_PANEL_ID_KEYS = ('id_panel', 'idPanel', 'panel_id', 'panelId', 'id')
# Контейнеры, внутри которых может быть вложен полезный объект.
_ENVELOPE_KEYS = ('data', 'result', 'response', 'user', 'person', 'panel')
# 'mag' — опечатка на их стороне, не наша: неверный логин/пароль приходит
# как {"success": false, "mag": "Error auth"}. Проверено на живом cascate.ru.
_ERROR_KEYS = ('error', 'errors', 'message', 'msg', 'mag')
# Флаг неуспеха и значения, которые его означают.
_FAILURE_FLAGS = ('success', 'ok', 'status')
_FAILURE_VALUES = (False, 0, '0', 'error', 'fail')
# По этим словам отличаем отвергнутый токен приложения от неверного пароля
# пользователя: {"success": false, "error": "Не верный токен!"}.
_TOKEN_HINTS = ('токен', 'token')


class CascateError(Exception):
    """Любая проблема при общении с cascate.ru."""


class CascateAuthError(CascateError):
    """Неверный логин/пароль пользователя."""


class CascateTokenError(CascateError):
    """Токен приложения отвергнут — это ошибка конфигурации, не пользователя."""


def _unwrap(payload):
    """Развернуть {'data': {...}} → {...}. Один уровень, этого достаточно."""
    if isinstance(payload, dict):
        for key in _ENVELOPE_KEYS:
            inner = payload.get(key)
            if isinstance(inner, dict):
                return inner
    return payload


def _find_id(payload, keys):
    """Достать первый непустой идентификатор из payload по списку ключей."""
    for source in (payload, _unwrap(payload)):
        if not isinstance(source, dict):
            continue
        for key in keys:
            value = source.get(key)
            if value not in (None, '', 0, '0'):
                return str(value)
    return None


def _extract_error(payload):
    """Вернуть текст ошибки, если ответ её содержит, иначе None."""
    if not isinstance(payload, dict):
        return None
    for key in _ERROR_KEYS:
        value = payload.get(key)
        if value:
            return str(value)
    for flag in _FAILURE_FLAGS:
        if flag in payload and payload[flag] in _FAILURE_VALUES:
            return f'{flag}={payload[flag]!r}'
    return None


def _num(value):
    """Число → строка с точкой-разделителем, два знака. PHP так съест."""
    try:
        return f'{float(value or 0):.2f}'
    except (TypeError, ValueError):
        return '0.00'


def _code(joint):
    return joint.code if joint else ''


def _name(obj):
    return obj.name if obj else ''


class CascateClient:
    def __init__(self, token=None, base_url=None, timeout=None):
        self.token = token or settings.CASCATE_TOKEN
        if not self.token:
            raise CascateError('CASCATE_TOKEN не задан в .env')
        self.base_url = (base_url or settings.CASCATE_BASE_URL).rstrip('/') + '/'
        self.timeout = timeout or settings.CASCATE_TIMEOUT
        self.session = requests.Session()

    def _post(self, endpoint, data):
        # Слеш в конце обязателен, редирект = потерянное тело.
        url = f'{self.base_url}{endpoint}/'
        body = {'token': self.token, **data}
        try:
            resp = self.session.post(
                url, data=body, timeout=self.timeout, allow_redirects=False,
            )
        except requests.RequestException as exc:
            raise CascateError(f'{endpoint}: сеть недоступна ({exc})') from exc

        if resp.is_redirect:
            raise CascateError(
                f'{endpoint}: сервер редиректит на {resp.headers.get("Location")!r} — '
                f'POST-тело потеряно, проверьте CASCATE_BASE_URL'
            )
        if resp.status_code >= 400:
            raise CascateError(f'{endpoint}: HTTP {resp.status_code} — {resp.text[:300]}')

        try:
            payload = resp.json()
        except ValueError:
            raise CascateError(f'{endpoint}: ответ не JSON — {resp.text[:300]!r}')

        error = _extract_error(payload)
        if error:
            if any(w in error.lower() for w in _TOKEN_HINTS):
                raise CascateTokenError(f'{endpoint}: {error}')
            raise CascateError(f'{endpoint}: {error}')
        return payload

    def login(self, login, password):
        """Обменять логин/пароль на id_person. Пароль нигде не логируется."""
        try:
            payload = self._post('login', {'login': login, 'password': password})
        except CascateTokenError:
            # Чинить .env, а не пароль — не подменять диагноз.
            raise
        except CascateError as exc:
            # Отличить «не пустили» от «сервис лежит» по тексту — грубо, но
            # без спецификации ответа точнее не выйдет.
            text = str(exc).lower()
            if any(w in text for w in ('pass', 'логин', 'парол', 'auth', 'denied')):
                raise CascateAuthError(str(exc)) from exc
            raise

        id_person = _find_id(payload, _PERSON_ID_KEYS)
        if not id_person:
            raise CascateError(
                f'login: в ответе нет id_person — получено {str(payload)[:300]}'
            )
        return id_person

    def add_panel(self, id_person, payload):
        """Отправить одну панель. Возвращает внешний id или '' если не отдали."""
        response = self._post('addPanel', {'id_person': id_person, **payload})
        return _find_id(response, _PANEL_ID_KEYS) or ''


# ─── Сборка payload ──────────────────────────────────────────────────────────
#
# Состав полей согласован не был («остальные поля от твоей реализации»),
# поэтому шлём плоский набор скаляров, покрывающий модель целиком.
# external_id — подсказка принимающей стороне для дедупликации.

def _order_fields(order):
    return {
        'source': 'nuovo60',
        'order_id': order.id,
        'order_number': order.order_number,
        'invoice_number': order.invoice_number,
        'customer_name': order.customer_name,
        'agent_name': order.agent_name,
        'counterparty': order.counterparty,
        'city': order.city,
    }


def build_panel_payload(order, panel):
    """Стеновая панель → поля addPanel."""
    return {
        **_order_fields(order),
        'external_id': f'panel-{panel.id}',
        'panel_type': 'wall',
        'position': panel.position,
        'wall_number': panel.wall_number,
        'quantity': panel.quantity,
        'height': _num(panel.height_mm),
        'width': _num(panel.width_mm),
        'area': _num(panel.area_sqm),
        'joint_left': _code(panel.joint_left),
        'joint_right': _code(panel.joint_right),
        'joint_top': _code(panel.joint_top),
        'joint_bottom': _code(panel.joint_bottom),
        'finish_group': _name(panel.finish_group),
        'finish': _name(panel.finish),
        'veneer_direction': panel.veneer_direction,
        'decor_name': panel.decor_name,
        'aluminum_vertical_count': panel.aluminum_vertical_count,
        'aluminum_horizontal_count': panel.aluminum_horizontal_count,
        'aluminum_color': _name(panel.aluminum_color),
        'markup_percent': _num(panel.markup_percent),
        'cost': _num(panel.total_cost),
        'notes': panel.notes,
    }


def build_door_panel_payload(order, panel):
    """Панель над дверью → поля addPanel. Узлы другие, ключ panel_type='door'."""
    return {
        **_order_fields(order),
        'external_id': f'door-{panel.id}',
        'panel_type': 'door',
        'position': panel.position,
        'wall_number': panel.wall_number,
        'quantity': panel.quantity,
        'height': _num(panel.panel_height),
        'width': _num(panel.panel_width),
        'area': _num(panel.area_sqm),
        'door_order_number': panel.door_order_number,
        'opening_width': _num(panel.opening_width),
        'opening_height': _num(panel.opening_height),
        'ceiling_height': _num(panel.ceiling_height),
        'mount_type': panel.mount_type,
        'opening_direction': panel.opening_direction,
        'joint_top_left': _code(panel.joint_top_left),
        'joint_top_right': _code(panel.joint_top_right),
        'joint_bottom': _code(panel.joint_bottom),
        'edge_left': _code(panel.edge_left),
        'edge_right': _code(panel.edge_right),
        'edge_top': _code(panel.edge_top),
        'edge_bottom': _code(panel.edge_bottom),
        'finish_group': _name(panel.finish_group),
        'finish': _name(panel.finish),
        'veneer_direction': panel.veneer_direction,
        'decor_name': panel.decor_name,
        'markup_percent': _num(panel.markup_percent),
        'cost': _num(panel.total_cost),
        'notes': panel.notes,
    }
