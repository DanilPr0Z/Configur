import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { JointType } from '../api'

interface Props {
  value: number | null
  jointTypes: JointType[]
  onChange: (id: number | null) => void
  allowEmpty?: boolean
}

// Обёртка для конфигуратора — работает с кодами (строками), а не ID
interface PropsCode {
  value: string
  codes: string[]
  jointTypes: JointType[]
  onChange: (code: string) => void
  allowEmpty?: boolean
  fallback?: { code: string; name: string }[]
}

// Универсальный красивый дропдаун для строковых значений (шпон и т.п.)
interface PropsStr {
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder?: string
}

export function StringSelect({ value, options, onChange, placeholder = '— выбрать' }: PropsStr) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div style={{ display: 'block', width: '100%' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          width: '100%', height: 30, padding: '0 10px',
          border: open ? '1.5px solid #1a4d8a' : '1.5px solid #d0d7e3',
          borderRadius: 6, background: open ? '#f0f6ff' : '#fff',
          cursor: 'pointer', fontSize: 13,
          fontWeight: value ? 600 : 400,
          color: value ? '#1a1a2e' : '#aaa',
          boxShadow: open ? '0 0 0 3px rgba(26,77,138,.1)' : 'none',
          transition: 'border-color .15s, background .15s',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: .4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && createPortal(
        <div ref={dropRef} style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, zIndex: 99999, minWidth: dropPos.width }}>
          <div style={{ background: '#fff', border: '1.5px solid #d0d7e3', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.14)', overflow: 'hidden' }}>
            {options.map(opt => (
              <div
                key={opt}
                style={{
                  padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                  background: value === opt ? '#e8f2ff' : 'transparent',
                  borderLeft: value === opt ? '3px solid #1a4d8a' : '3px solid transparent',
                  fontWeight: value === opt ? 600 : 400,
                  color: '#222',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = value === opt ? '#e8f2ff' : '#f5f8ff')}
                onMouseLeave={e => (e.currentTarget.style.background = value === opt ? '#e8f2ff' : 'transparent')}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function JointSelectCode({ value, codes, jointTypes, onChange, allowEmpty = false, fallback = [] }: PropsCode) {
  // Добавляем локальные коды которых нет в API (например TC — Теневой профиль)
  const merged: JointType[] = [
    ...jointTypes,
    ...fallback
      .filter(f => !jointTypes.find(j => j.code === f.code))
      .map((f, i) => ({
        id: -(i + 1),
        code: f.code,
        name: f.name,
        offset_mm: 0,
        price_per_meter: 0,
        profile_article: '',
        profile_count: 0,
        image_url: null,
      })),
  ]
  const filtered = merged.filter(j => codes.includes(j.code))
  const selectedId = merged.find(j => j.code === value)?.id ?? null
  return (
    <JointSelect
      value={selectedId}
      jointTypes={filtered}
      onChange={id => {
        const code = merged.find(j => j.id === id)?.code ?? ''
        onChange(code)
      }}
      allowEmpty={allowEmpty}
    />
  )
}

export default function JointSelect({ value, jointTypes, onChange, allowEmpty: _allowEmpty = true }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<JointType | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const selected = jointTypes.find(j => j.id === value) ?? null

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({
        top: r.bottom + window.scrollY + 4,
        left: r.left + window.scrollX,
        width: Math.max(r.width, 160),
      })
    }
    setOpen(true)
    setHovered(null)
  }

  // закрыть по клику снаружи
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (
        !dropRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
        setHovered(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div style={{ display: 'block', width: '100%' }}>
      {/* Кнопка-триггер */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? (setOpen(false), setHovered(null)) : openDropdown())}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: 30,
          padding: '0 10px',
          border: open ? '1.5px solid #1a4d8a' : '1.5px solid #d0d7e3',
          borderRadius: 6,
          background: open ? '#f0f6ff' : '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: selected ? 700 : 400,
          color: selected ? '#1a4d8a' : '#aaa',
          transition: 'border-color .15s, background .15s',
          boxShadow: open ? '0 0 0 3px rgba(26,77,138,.1)' : 'none',
          textAlign: 'left',
        }}
      >
        {selected ? (
          <>
            <span style={{
              background: '#1a4d8a', color: '#fff', borderRadius: 4,
              padding: '1px 6px', fontSize: 11, fontWeight: 700,
              letterSpacing: .3, flexShrink: 0,
            }}>
              {selected.code}
            </span>
            <span style={{ fontSize: 11, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name || ''}
            </span>
          </>
        ) : (
          <span style={{ color: '#bbb', fontSize: 12, flex: 1 }}>— выбрать</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: .4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Дропдаун через портал */}
      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, zIndex: 99999, display: 'flex', alignItems: 'flex-start', gap: 0 }}
        >
          {/* Список */}
          <div
            style={{
              background: '#fff',
              border: '1.5px solid #d0d7e3',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,.14)',
              minWidth: dropPos.width,
              maxHeight: 320,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            // onMouseLeave — сброс только когда уходим из всего списка
            onMouseLeave={() => setHovered(null)}
          >
            {/* Пункт «Нет» */}
            <div
              style={{
                padding: '7px 12px',
                cursor: 'pointer',
                color: '#aaa',
                fontSize: 12,
                borderBottom: '1px solid #f2f4f8',
                background: value === null ? '#f5f8ff' : 'transparent',
              }}
              onMouseEnter={() => setHovered(null)}
              onClick={() => { onChange(null); setOpen(false) }}
            >
              — нет
            </div>

            {jointTypes.map(j => {
              const isSelected = value === j.id
              const isHovered = hovered?.id === j.id
              return (
                <div
                  key={j.id}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    background: isSelected ? '#e8f2ff' : isHovered ? '#f5f8ff' : 'transparent',
                    borderLeft: isSelected ? '3px solid #1a4d8a' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={() => setHovered(j)}
                  onClick={() => { onChange(j.id); setOpen(false); setHovered(null) }}
                >
                  {/* Бейдж кода */}
                  <span style={{
                    background: isSelected ? '#1a4d8a' : isHovered ? '#3a6db5' : '#e8edf5',
                    color: isSelected || isHovered ? '#fff' : '#444',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 26,
                    textAlign: 'center',
                    flexShrink: 0,
                    transition: 'background .1s, color .1s',
                  }}>
                    {j.code}
                  </span>

                  {/* Название */}
                  <span style={{
                    fontSize: 11,
                    color: isHovered ? '#333' : '#666',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}>
                    {j.name || '—'}
                  </span>

                  {/* Иконка фото если есть */}
                  {j.image_url && (
                    <span style={{ fontSize: 10, color: '#1a4d8a', opacity: .5, flexShrink: 0 }}>▶</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Превью справа */}
          {hovered && (
            <div style={{
              marginLeft: 10,
              background: '#fff',
              border: '1.5px solid #d0d7e3',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,.16)',
              pointerEvents: 'none',
              width: 230,
              flexShrink: 0,
            }}>
              {hovered.image_url ? (
                <img
                  src={hovered.image_url}
                  alt={hovered.code}
                  style={{ display: 'block', width: 230, height: 172, objectFit: 'contain' }}
                />
              ) : (
                /* Заглушка если фото нет */
                <div style={{
                  width: 230,
                  height: 172,
                  background: 'linear-gradient(135deg, #e8f0fe 0%, #d0dcf5 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    fontSize: 48,
                    fontWeight: 900,
                    color: '#1a4d8a',
                    opacity: .25,
                    lineHeight: 1,
                  }}>
                    {hovered.code}
                  </span>
                  <span style={{ fontSize: 11, color: '#888' }}>фото не загружено</span>
                </div>
              )}

              {/* Подпись */}
              <div style={{
                padding: '8px 12px',
                background: '#f4f8ff',
                borderTop: '1px solid #e0e8f5',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1a4d8a' }}>
                  {hovered.code}
                </span>
                {hovered.name && (
                  <span style={{ fontSize: 12, color: '#666' }}>{hovered.name}</span>
                )}
                {hovered.offset_mm !== 0 && (
                  <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                    {hovered.offset_mm > 0 ? '+' : ''}{hovered.offset_mm} мм
                  </span>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
