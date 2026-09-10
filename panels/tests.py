"""Доступ к заказам: вход обязателен, каждый видит только свои."""

from rest_framework.test import APITestCase

from .models import CascateSession, Order


def session(id_person: str) -> dict:
    """Заголовок вошедшего пользователя: пропуск — токен, а не сам id_person."""
    s = CascateSession.objects.create(token=f'tok-{id_person}', id_person=id_person)
    return {'HTTP_X_CASCATE_TOKEN': s.token}


class OrderAccessTests(APITestCase):
    def setUp(self):
        self.a, self.b = session('user-A'), session('user-B')
        self.own = Order.objects.create(series='60', customer_name='Заказ A',
                                        cascate_id_person='user-A')
        # Заказ из версии до разделения по аккаунтам — владельца нет
        self.legacy = Order.objects.create(series='60', customer_name='Старый')

    def test_без_входа_ничего_не_видно(self):
        for url in ('/api/orders/', '/api/joint-types/', '/api/panels/'):
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_чужой_id_person_без_токена_не_пускает(self):
        # id_person не секрет: сам по себе он больше не пропуск
        r = self.client.get('/api/orders/', HTTP_X_CASCATE_ID='user-A')
        self.assertEqual(r.status_code, 403)
        r = self.client.get('/api/orders/', HTTP_X_CASCATE_TOKEN='подделка')
        self.assertEqual(r.status_code, 403)

    def test_выход_гасит_токен(self):
        self.assertEqual(self.client.get('/api/orders/', **self.a).status_code, 200)
        self.client.post('/api/auth/cascate-logout/', **self.a)
        self.assertEqual(self.client.get('/api/orders/', **self.a).status_code, 403)

    def test_в_списке_только_свои_и_общие(self):
        names = [o['customer_name'] for o in self.client.get('/api/orders/', **self.a).json()]
        self.assertCountEqual(names, ['Заказ A', 'Старый'])
        self.assertCountEqual(
            [o['customer_name'] for o in self.client.get('/api/orders/', **self.b).json()],
            ['Старый'],
        )

    def test_чужой_заказ_не_открыть_и_не_удалить(self):
        url = f'/api/orders/{self.own.id}/'
        self.assertEqual(self.client.get(url, **self.b).status_code, 404)
        self.assertEqual(self.client.delete(url, **self.b).status_code, 404)
        self.assertEqual(self.client.get(url, **self.a).status_code, 200)

    def test_новый_заказ_закрепляется_за_создателем(self):
        r = self.client.post('/api/orders/', {'series': '60', 'customer_name': 'Новый'},
                             format='json', **self.b)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Order.objects.get(id=r.json()['id']).cascate_id_person, 'user-B')
