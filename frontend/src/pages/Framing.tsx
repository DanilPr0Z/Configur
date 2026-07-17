import { useEffect, useMemo, useState } from 'react'
import { fetchFramingConfig, createFramingLead } from '../api'
import {
  buildCatalog, computeSpec, defaultState, glassInsertOptions, SCHEMES,
  type FramingCatalog, type FramingState, type KitType, type InstType, type SpecRow,
} from '../framing/framingData'

const fmt = (n: number) => n.toLocaleString('ru-RU')
const STEPS = ['Модель', 'Параметры', 'Спецификация', 'Заявка']

export default function Framing() {
  const [cat, setCat] = useState<FramingCatalog | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [st, setSt] = useState<FramingState>(defaultState())

  const [invoice, setInvoice] = useState('')
  const [buyer, setBuyer] = useState('')
  const [note, setNote] = useState('')

  const [lead, setLead] = useState({ name: '', phone: '', email: '', comment: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  useEffect(() => {
    fetchFramingConfig()
      .then(cfg => setCat(buildCatalog(cfg)))
      .catch(() => setLoadErr('Не удалось загрузить справочник обрамления. Проверьте, что сервер запущен.'))
  }, [])

  const spec = useMemo(() => cat ? computeSpec(st, cat) : null, [st, cat])

  if (loadErr) return (
    <div className="page"><div className="container">
      <h1 className="page-title">Обрамление проёма</h1>
      <div className="alert alert-error">{loadErr}</div>
    </div></div>
  )
  if (!cat || !spec) return (
    <div className="page"><div className="container">
      <h1 className="page-title">Обрамление проёма</h1>
      <div className="flex-center gap-2"><span className="spinner" /> Загрузка справочника…</div>
    </div></div>
  )

  const model = cat.models[st.mi]
  const dobGroup = cat.doborItems[st.di]?.group || cat.doborGroupNames[0]
  const patch = (p: Partial<FramingState>) => setSt(s => ({ ...s, ...p }))
  const showNal = st.kit !== 'dob'
  const showDob = st.kit !== 'nal'
  const hasGlass = model.has_glass && showNal

  function go(n: number) {
    if (n > step && !validate(n)) return
    setStep(n); setMaxStep(m => Math.max(m, n))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function validate(n: number): boolean {
    if (n >= 2) {
      const { H, L, C } = st
      if (!H || !L || !C) { alert('Укажите размеры проёма (высота, ширина, глубина)'); return false }
      if (H < 500 || H > 3000) { alert('Высота должна быть от 500 до 3000 мм'); return false }
      if (L < 400 || L > 1500) { alert('Ширина должна быть от 400 до 1500 мм'); return false }
      if (C < 50 || C > 750) { alert('Глубина должна быть от 50 до 750 мм'); return false }
    }
    return true
  }

  function pickModel(i: number) {
    const m = cat!.models[i]
    patch({ mi: i, glassGroup: m.has_glass ? st.glassGroup : '', glassInsert: '', glassColor: '' })
  }

  function setDobGroup(g: string) {
    const idx = cat!.doborItems.findIndex(d => d.group === g)
    patch({ di: idx >= 0 ? idx : 0 })
  }

  function setGlassGroup(g: string) {
    const opts = glassInsertOptions(g, cat!)
    patch({ glassGroup: g, glassInsert: opts[0] || '', glassColor: '' })
  }

  async function submit() {
    if (!lead.name.trim() || !lead.phone.trim()) {
      alert('Пожалуйста, укажите имя и телефон'); return
    }
    setSending(true); setSendErr(null)
    try {
      await createFramingLead({
        name: lead.name.trim(),
        phone: lead.phone.trim(),
        email: lead.email.trim(),
        comment: lead.comment.trim(),
        invoice_number: invoice.trim(),
        buyer: buyer.trim(),
        note: note.trim(),
        model_name: model.name,
        install: st.inst,
        kit: st.kit,
        opening_height: st.H,
        opening_width: st.L,
        wall_depth: st.C,
        color_name: showNal ? cat!.colors[st.ci] : '',
        dobor_name: showDob ? (cat!.doborItems[st.di]?.name || '') : '',
        glass: hasGlass && st.glassGroup
          ? [st.glassGroup, st.glassInsert, st.glassColor].filter(Boolean).join(' · ') : '',
        spec: spec!.rows,
        total: spec!.total,
      })
      setSent(true)
    } catch {
      setSendErr('Не удалось отправить заявку. Проверьте, что сервер запущен, и повторите.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Обрамление проёма</h1>

        <div className="steps no-print">
          {STEPS.map((label, i) => {
            const n = i + 1
            const cls = n === step ? 'step active' : n < step ? 'step done' : 'step'
            const locked = n > maxStep
            return (
              <div key={label} className={cls}
                style={locked ? { opacity: .5, cursor: 'not-allowed' } : undefined}
                onClick={() => !locked && go(n)}>
                {n}. {label}
              </div>
            )
          })}
        </div>

        {/* ── ШАГ 1: МОДЕЛЬ ── */}
        {step === 1 && (
          <>
            <div className="card">
              <h2>Выберите модель наличника</h2>
              <div className="fr-model-grid">
                {cat.models.map((m, i) => (
                  <div key={m.name} className={'fr-model' + (i === st.mi ? ' on' : '')}
                    onClick={() => pickModel(i)}>
                    <span className="fr-model-n">{m.name}</span>
                    <span className="fr-model-t">{m.subtitle}</span>
                  </div>
                ))}
              </div>
              <SchemeBox model={model.name} />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-primary" onClick={() => go(2)}>Далее →</button>
            </div>
          </>
        )}

        {/* ── ШАГ 2: ПАРАМЕТРЫ ── */}
        {step === 2 && (
          <>
            <div className="card">
              <h2>Размеры проёма</h2>
              <div className="grid-3">
                <div className="field">
                  <label>Высота H, мм <span className="text-muted">500–3000</span></label>
                  <input type="number" value={st.H} min={500} max={3000}
                    onChange={e => patch({ H: +e.target.value })} />
                </div>
                <div className="field">
                  <label>Ширина L, мм <span className="text-muted">400–1500</span></label>
                  <input type="number" value={st.L} min={400} max={1500}
                    onChange={e => patch({ L: +e.target.value })} />
                </div>
                <div className="field">
                  <label>Глубина C, мм <span className="text-muted">50–750</span></label>
                  <input type="number" value={st.C} min={50} max={750}
                    onChange={e => patch({ C: +e.target.value })} />
                </div>
              </div>
              <IzmerScheme model={model} H={st.H} L={st.L} C={st.C} />
            </div>

            <div className="card">
              <div className="grid-2">
                <div className="field">
                  <label>Что рассчитать</label>
                  <div className="fr-tabs">
                    {(['both', 'nal', 'dob'] as KitType[]).map(k => (
                      <div key={k} className={'fr-tab' + (st.kit === k ? ' on' : '')}
                        onClick={() => patch({ kit: k })}>
                        {k === 'both' ? 'Наличник + добор' : k === 'nal' ? 'Только наличник' : 'Только добор'}
                      </div>
                    ))}
                  </div>
                </div>
                {showNal && (
                  <div className="field">
                    <label>Установка наличника</label>
                    <div className="fr-tabs">
                      {(['с двух сторон', 'с одной стороны'] as InstType[]).map(v => (
                        <div key={v} className={'fr-tab' + (st.inst === v ? ' on' : '')}
                          onClick={() => patch({ inst: v })}>
                          {v === 'с двух сторон' ? 'С двух сторон' : 'С одной стороны'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid-2 mt-4">
                {showNal && (
                  <div className="field">
                    <label>Цвет профиля наличника</label>
                    <select value={st.ci} onChange={e => patch({ ci: +e.target.value })}>
                      {cat.colors.map((c, i) => <option key={c} value={i}>{c}</option>)}
                    </select>
                  </div>
                )}
                {showDob && (
                  <div className="field">
                    <label>Группа добора</label>
                    <select value={dobGroup} onChange={e => setDobGroup(e.target.value)}>
                      {cat.doborGroupNames.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                {showDob && (
                  <div className="field">
                    <label>Отделка добора</label>
                    <select value={st.di} onChange={e => patch({ di: +e.target.value })}>
                      {cat.doborItems.map((d, i) => d.group === dobGroup
                        ? <option key={i} value={i}>{d.name}</option> : null)}
                    </select>
                  </div>
                )}
              </div>

              {hasGlass && (
                <div className="grid-2 mt-4">
                  <div className="field">
                    <label>Группа вставки</label>
                    <select value={st.glassGroup} onChange={e => setGlassGroup(e.target.value)}>
                      <option value="">— без вставки —</option>
                      {cat.glassGroupNames.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  {st.glassGroup && (
                    <div className="field">
                      <label>Отделка вставки</label>
                      <select value={st.glassInsert} onChange={e => patch({ glassInsert: e.target.value })}>
                        {glassInsertOptions(st.glassGroup, cat).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}
                  {st.glassGroup === 'СТЕКЛО' && (
                    <div className="field">
                      <label>Цвет стекла / зеркала</label>
                      <input type="text" value={st.glassColor}
                        onChange={e => patch({ glassColor: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {spec.warn && <div className="alert alert-error mt-4">⚠ {spec.warn}</div>}
            </div>

            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => go(1)}>← Назад</button>
              <button className="btn btn-primary" onClick={() => go(3)}>Рассчитать →</button>
            </div>
          </>
        )}

        {/* ── ШАГ 3: СПЕЦИФИКАЦИЯ ── */}
        {step === 3 && (
          <>
            <div className="card">
              <div className="grid-2">
                <div className="field">
                  <label>Номер счёта</label>
                  <input type="text" value={invoice} placeholder="Например: СЧ-2024-001"
                    onChange={e => setInvoice(e.target.value)} />
                </div>
                <div className="field">
                  <label>Покупатель</label>
                  <input type="text" value={buyer} placeholder="ФИО или название организации"
                    onChange={e => setBuyer(e.target.value)} />
                </div>
              </div>

              <div className="fr-dims mt-4">
                <div className="fr-dim"><div className="fr-dim-v">{st.H} мм</div><div className="fr-dim-l">Высота проёма</div></div>
                <div className="fr-dim"><div className="fr-dim-v">{st.L} мм</div><div className="fr-dim-l">Ширина проёма</div></div>
                <div className="fr-dim"><div className="fr-dim-v">{st.C} мм</div><div className="fr-dim-l">Глубина стены</div></div>
              </div>

              <div className="table-wrap mt-4">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '46%' }}>Наименование</th>
                      <th style={{ width: '24%' }}>Размер</th>
                      <th style={{ textAlign: 'center' }}>Шт.</th>
                      <th style={{ textAlign: 'right' }}>Сумма, ₽</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spec.rows.map((r: SpecRow, idx) => (
                      <tr key={idx} style={r.cl === 'sur' ? { color: 'var(--accent-color)' } : r.cl === 'glass' ? { background: '#f5f5f5' } : undefined}>
                        <td>{r.nm}</td>
                        <td className="text-muted">{r.dm}</td>
                        <td style={{ textAlign: 'center' }}>{r.qt}</td>
                        <td className="text-right fw-bold">{fmt(r.pr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="summary-row total mt-4">
                <span>Итого к заказу</span>
                <span className="price">{fmt(spec.total)} ₽</span>
              </div>

              <div className="field mt-4">
                <label>Примечание</label>
                <textarea value={note} placeholder="Дополнительные условия, пожелания, особенности монтажа..."
                  onChange={e => setNote(e.target.value)} />
              </div>

              <SchemeBox model={model.name} />
            </div>

            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => go(2)}>← Изменить</button>
              <button className="btn btn-ghost no-print" onClick={() => window.print()}>⬇ Печать / PDF</button>
              <button className="btn btn-success" onClick={() => go(4)}>Оформить заявку →</button>
            </div>
          </>
        )}

        {/* ── ШАГ 4: ЗАЯВКА ── */}
        {step === 4 && (
          <>
            {!sent ? (
              <>
                <div className="card">
                  <div className="alert alert-info" style={{ lineHeight: 1.7 }}>
                    <strong>Модель:</strong> {model.name} · <strong>Установка:</strong> {st.inst}<br />
                    <strong>Размеры проёма:</strong> {st.H} × {st.L} × {st.C} мм<br />
                    {showNal && <><strong>Наличник:</strong> {cat.colors[st.ci]} </>}
                    {showDob && <>· <strong>Добор:</strong> {cat.doborItems[st.di]?.name}</>}<br />
                    <strong>Итого:</strong> {fmt(spec.total)} ₽
                  </div>

                  <h2>Ваши контактные данные</h2>
                  <div className="grid-2">
                    <div className="field">
                      <label>Имя *</label>
                      <input type="text" value={lead.name} placeholder="Ваше имя"
                        onChange={e => setLead({ ...lead, name: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Телефон *</label>
                      <input type="text" value={lead.phone} placeholder="+7 (___) ___-__-__"
                        onChange={e => setLead({ ...lead, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="field mt-4">
                    <label>Email</label>
                    <input type="text" value={lead.email} placeholder="email@example.com"
                      onChange={e => setLead({ ...lead, email: e.target.value })} />
                  </div>
                  <div className="field mt-4">
                    <label>Комментарий</label>
                    <textarea value={lead.comment} placeholder="Дополнительные пожелания, вопросы по проекту..."
                      onChange={e => setLead({ ...lead, comment: e.target.value })} />
                  </div>
                  {sendErr && <div className="alert alert-error mt-4">{sendErr}</div>}
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-ghost" onClick={() => go(3)}>← Назад</button>
                  <button className="btn btn-success" onClick={submit} disabled={sending}>
                    {sending ? <span className="spinner" /> : 'Отправить заявку'}
                  </button>
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ fontSize: 44 }}>✓</div>
                <h2 style={{ justifyContent: 'center' }}>Заявка отправлена</h2>
                <p className="text-muted">Заявка сохранена в ЛК (раздел «Заявки обрамления»). Менеджер свяжется с вами в течение рабочего дня.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SchemeBox({ model }: { model: string }) {
  const imgs = SCHEMES[model]
  return (
    <div className="fr-scheme mt-4">
      <div className="fr-scheme-top">Схема сборки — {model}</div>
      <div className="fr-scheme-body">
        {imgs
          ? imgs.map(src => (
            <div key={src} className="fr-scheme-img"><img src={src} alt={model} /></div>
          ))
          : <span className="text-muted">Схема не найдена</span>}
      </div>
    </div>
  )
}

function IzmerScheme({ model, H, L, C }: { model: { nH: number; nL: number }; H: number; L: number; C: number }) {
  const num = (v: number) => `${Math.round(v)} мм`
  const pins: { id: string; left: string; top: string; v: number; vert?: boolean }[] = [
    { id: 'Lp', left: '20%', top: '25.5%', v: L },
    { id: 'Hp', left: '8%', top: '45%', v: H, vert: true },
    { id: 'Cp', left: '19.5%', top: '59%', v: C },
    { id: 'Ln', left: '77%', top: '22.5%', v: L + model.nL },
    { id: 'Ls', left: '76.5%', top: '29%', v: L - 50 },
    { id: 'Hs', left: '63.5%', top: '47%', v: H - 25, vert: true },
    { id: 'Hn', left: '94%', top: '48%', v: H + model.nH, vert: true },
  ]
  return (
    <div className="fr-izmer mt-4">
      <img src="/schemes/izmer.jpg" alt="Схема замера обрамления проёма" />
      {pins.map(p => (
        <span key={p.id} className={'fr-iz' + (p.vert ? ' fr-iz-v' : '')}
          style={{ left: p.left, top: p.top }}>{num(p.v)}</span>
      ))}
    </div>
  )
}
