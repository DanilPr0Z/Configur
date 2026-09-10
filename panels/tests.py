"""Доступ к заказам: вход обязателен, каждый видит только свои."""

from rest_framework.test import APITestCase

from .models import Order

A = {'HTTP_X_CASCATE_ID': 'user-A'}
B = {'HTTP_X_CASCATE_ID': 'user-B'}


class OrderAccessTests(APITestCase):
    def setUp(self):
        self.own = Order.objects.create(series='60', customer_name='Заказ A',
                                        cascate_id_person='user-A')
        # Заказ из версии до разделения по аккаунтам — владельца нет
        self.legacy = Order.objects.create(series='60', customer_name='Старый')

    def test_без_входа_ничего_не_видно(self):
        for url in ('/api/orders/', '/api/joint-types/', '/api/panels/'):
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_в_списке_только_свои_и_общие(self):
        names = [o['customer_name'] for o in self.client.get('/api/orders/', **A).json()]
        self.assertCountEqual(names, ['Заказ A', 'Старый'])
        self.assertCountEqual(
            [o['customer_name'] for o in self.client.get('/api/orders/', **B).json()],
            ['Старый'],
        )

    def test_чужой_заказ_не_открыть_и_не_удалить(self):
        url = f'/api/orders/{self.own.id}/'
        self.assertEqual(self.client.get(url, **B).status_code, 404)
        self.assertEqual(self.client.delete(url, **B).status_code, 404)
        self.assertEqual(self.client.get(url, **A).status_code, 200)

    def test_новый_заказ_закрепляется_за_создателем(self):
        r = self.client.post('/api/orders/', {'series': '60', 'customer_name': 'Новый'},
                             format='json', **B)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Order.objects.get(id=r.json()['id']).cascate_id_person, 'user-B')
