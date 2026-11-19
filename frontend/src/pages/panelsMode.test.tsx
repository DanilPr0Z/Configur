// Раздел «Панели»: отдельные панели без стен и проёмов.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router-dom'
import Configurator from './Configurator'

async function render(el: React.ReactElement) {
  const routes = [{ path: '/', element: el }]
  const { query } = createStaticHandler(routes)
  const ctx = await query(new Request('http://localhost/'))
  if (ctx instanceof Response) throw new Error('redirect')
  return renderToStaticMarkup(
    <StaticRouterProvider router={createStaticRouter(routes, ctx)} context={ctx} />)
}

describe('Configurator panelsOnly', () => {
  for (const series of ['60', '50'] as const) {
    it(`NUOVO ${series}: одна панель, без кнопок стены и проёма`, async () => {
      const html = await render(<Configurator series={series} panelsOnly />)
      expect(html).toContain(`Панели — NUOVO ${series}`)
      expect(html).toContain('+ Добавить панель')
      expect(html).toContain('Высота панели, мм')
      expect(html).toContain('Ширина панели, мм')
      expect(html).toContain('Панель 1')
      expect(html).not.toContain('+ Добавить стену')
      expect(html).not.toContain('Дверной проём')
      expect(html).not.toContain('Кол-во панелей')
      expect(html).not.toContain('Зазор сверху')
    })
  }
  it('обычный конфигуратор по-прежнему со стенами', async () => {
    const html = await render(<Configurator series="60" />)
    expect(html).toContain('+ Добавить стену')
    expect(html).not.toContain('+ Добавить панель')
  })
})
