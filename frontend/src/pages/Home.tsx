import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    to: '/wall-60',
    title: 'Стеновые 60',
    desc: 'Конфигуратор и расчёт стеновых панелей серии NUOVO 60 с учётом узлов.',
    tag: 'Готово',
  },
  {
    to: '/wall-50',
    title: 'Стеновые 50',
    desc: 'Конфигуратор и расчёт стеновых панелей серии NUOVO 50 с учётом узлов.',
    tag: 'Готово',
  },
  {
    to: '/panel-60',
    title: 'Панели 60',
    desc: 'Отдельные панели NUOVO 60 без стены: свой размер, узлы и отделка.',
    tag: 'Готово',
  },
  {
    to: '/panel-50',
    title: 'Панели 50',
    desc: 'Отдельные панели NUOVO 50 без стены: свой размер, узлы и отделка.',
    tag: 'Готово',
  },
  {
    to: '/framing',
    title: 'Обрамление проёма',
    desc: 'Калькулятор наличников и доборов Cascate Porte: модели, цвета и отделки.',
    tag: 'Готово',
  },
]

export default function Home() {
  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">NUOVO — расчёт заказов</h1>
        <p className="text-muted" style={{ marginBottom: 24, fontSize: '.95rem' }}>
          Выберите раздел для расчёта.
        </p>
        <div className="grid-3">
          {SECTIONS.map(s => (
            <Link key={s.to} to={s.to} className="home-card">
              <span className={'badge ' + (s.tag === 'Готово' ? 'badge-green' : 'badge-gray')}>{s.tag}</span>
              <h2>{s.title}</h2>
              <p>{s.desc}</p>
              <span className="home-card-arrow">Открыть →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
