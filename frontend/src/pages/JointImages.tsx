import React, { useEffect, useState, useRef } from 'react'
import { fetchJointTypes, uploadJointImage, deleteJointImage, updateJointType } from '../api'
import type { JointType } from '../api'

const PASSWORD = 'VkHdd@Wc2'
const SESSION_KEY = 'joint_images_auth'

export default function JointImages() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pwInput === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuth(true)
    } else {
      setPwError(true)
      setPwInput('')
      setTimeout(() => setPwError(false), 1500)
    }
  }

  const [joints, setJoints] = useState<JointType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!auth) return
    fetchJointTypes().then(data => { setJoints(data); setLoading(false) })
  }, [auth])

  if (!auth) return (
    <div className="page">
      <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <form onSubmit={handlePwSubmit} style={{
          background: '#fff', border: '1px solid #e0e8f5', borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 36px', minWidth: 300, textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: '0 0 6px', color: '#1a4d8a', fontSize: 18 }}>Фотографии узлов</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 24px' }}>Введите пароль для доступа</p>
          <input
            type="password"
            value={pwInput}
            autoFocus
            onChange={e => setPwInput(e.target.value)}
            placeholder="Пароль"
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              padding: '10px 14px', fontSize: 15, borderRadius: 8,
              border: pwError ? '1.5px solid #ef4444' : '1.5px solid #d1d5db',
              outline: 'none', marginBottom: 12, transition: 'border-color 0.15s',
            }}
          />
          {pwError && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>Неверный пароль</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Войти</button>
        </form>
      </div>
    </div>
  )

  const showMsg = (id: number, text: string, ok: boolean) => {
    setMsg({ id, text, ok })
    setTimeout(() => setMsg(null), 2500)
  }

  const handleUpload = async (joint: JointType, file: File) => {
    setUploading(joint.id)
    try {
      const updated = await uploadJointImage(joint.id, file)
      setJoints(prev => prev.map(j => j.id === updated.id ? updated : j))
      showMsg(joint.id, 'Загружено', true)
    } catch {
      showMsg(joint.id, 'Ошибка загрузки', false)
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (joint: JointType) => {
    setUploading(joint.id)
    try {
      await deleteJointImage(joint.id)
      setJoints(prev => prev.map(j => j.id === joint.id ? { ...j, image_url: null } : j))
      showMsg(joint.id, 'Удалено', true)
    } catch {
      showMsg(joint.id, 'Ошибка', false)
    } finally {
      setUploading(null)
    }
  }

  if (loading) return (
    <div className="page"><div className="container">
      <div className="card" style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
    </div></div>
  )

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Фотографии узлов</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>
          Загрузите фото для каждого узла — оно будет показываться как превью при выборе в заказе.
          Рекомендуемый размер: от 400×300 пикселей, формат JPG или PNG.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {joints.map(joint => (
            <JointCard
              key={joint.id}
              joint={joint}
              busy={uploading === joint.id}
              msg={msg?.id === joint.id ? msg : null}
              onUpload={file => handleUpload(joint, file)}
              onDelete={() => handleDelete(joint)}
              onUpdate={updated => setJoints(prev => prev.map(j => j.id === updated.id ? updated : j))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  joint: JointType
  busy: boolean
  msg: { text: string; ok: boolean } | null
  onUpload: (file: File) => void
  onDelete: () => void
  onUpdate: (updated: JointType) => void
}

function JointCard({ joint, busy, msg, onUpload, onDelete, onUpdate }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    offset_mm: joint.offset_mm,
    price_per_meter: joint.price_per_meter,
    profile_article: joint.profile_article,
    profile_count: joint.profile_count,
  })

  const startEdit = () => {
    setDraft({
      offset_mm: joint.offset_mm,
      price_per_meter: joint.price_per_meter,
      profile_article: joint.profile_article,
      profile_count: joint.profile_count,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateJointType(joint.id, draft)
      onUpdate(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        border: editing ? '1.5px solid #93c5fd' : '1px solid #e0e8f5',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: editing ? '0 0 0 3px #dbeafe' : '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Превью */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4/3',
          background: joint.image_url ? '#000' : '#f4f6fb',
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        title="Нажмите чтобы загрузить фото"
        onClick={() => !busy && inputRef.current?.click()}
      >
        {joint.image_url ? (
          <img
            src={joint.image_url}
            alt={joint.code}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 12 }}>Нет фото</div>
          </div>
        )}
        {busy && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="spinner" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* Инфо */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a4d8a' }}>{joint.code}</div>
        {joint.name && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{joint.name}</div>}
      </div>

      {/* Формула расчёта */}
      <div style={{
        margin: '0 10px 8px',
        background: editing ? '#f0f7ff' : '#f8faff',
        border: editing ? '1px solid #93c5fd' : '1px solid #ddeaff',
        borderRadius: 8,
        padding: '7px 10px',
        fontSize: 11,
        lineHeight: 1.7,
        fontFamily: 'monospace',
      }}>
        <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Формула расчёта
          </span>
          {!editing && (
            <button
              onClick={startEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 10, padding: '1px 4px', borderRadius: 4 }}
              title="Редактировать"
            >
              ✏️ изм.
            </button>
          )}
        </div>

        {editing ? (
          <div style={{ fontFamily: 'sans-serif', fontSize: 11 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>
              <span style={{ color: '#555', fontSize: 10 }}>Δ ширины (вычет), мм</span>
              <input
                type="number"
                value={draft.offset_mm}
                step="0.5"
                onChange={e => setDraft(d => ({ ...d, offset_mm: +e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 5 }}>
              <span style={{ color: '#555', fontSize: 10 }}>Обработка, руб/пм</span>
              <input
                type="number"
                value={draft.price_per_meter}
                step="0.01"
                min={0}
                onChange={e => setDraft(d => ({ ...d, price_per_meter: +e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 5 }}>
              <span style={{ color: '#555', fontSize: 10 }}>Артикул профиля</span>
              <input
                type="text"
                value={draft.profile_article}
                onChange={e => setDraft(d => ({ ...d, profile_article: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 6 }}>
              <span style={{ color: '#555', fontSize: 10 }}>Кол-во профилей / узел</span>
              <input
                type="number"
                value={draft.profile_count}
                step="0.5"
                min={0}
                onChange={e => setDraft(d => ({ ...d, profile_count: +e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 0', fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ flex: 1, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 5, padding: '4px 0', fontSize: 11, cursor: 'pointer' }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              <span style={{ color: '#555' }}>Δ ширины:</span>
              <span style={{ color: joint.offset_mm === 0 ? '#999' : joint.offset_mm > 0 ? '#1a7a3a' : '#b91c1c', fontWeight: 600 }}>
                {joint.offset_mm > 0 ? '+' : ''}{joint.offset_mm} мм
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              <span style={{ color: '#555' }}>Обработка:</span>
              <span style={{ color: '#1a4d8a', fontWeight: 600 }}>
                {joint.price_per_meter > 0 ? `${joint.price_per_meter} руб/пм` : <span style={{ color: '#bbb' }}>—</span>}
              </span>
            </div>
            {joint.profile_article && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <span style={{ color: '#555' }}>Профиль:</span>
                <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                  {joint.profile_article}{joint.profile_count > 0 ? ` × ${joint.profile_count}` : ''}
                </span>
              </div>
            )}
            <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px dashed #dde', color: '#777', fontSize: 10, fontFamily: 'sans-serif' }}>
              {'B = (L_стены + Δлев + Δпр) / N'}
            </div>
          </>
        )}
      </div>

      {/* Кнопки */}
      <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {joint.image_url ? 'Заменить' : 'Загрузить'}
        </button>
        {joint.image_url && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={onDelete}
            title="Удалить фото"
          >
            ✕
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}
          style={{ margin: '0 10px 10px', padding: '5px 10px', fontSize: 12 }}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
