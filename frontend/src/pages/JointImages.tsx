import { useEffect, useState, useRef } from 'react'
import { fetchJointTypes, uploadJointImage, deleteJointImage } from '../api'
import type { JointType } from '../api'

export default function JointImages() {
  const [joints, setJoints] = useState<JointType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetchJointTypes().then(data => { setJoints(data); setLoading(false) })
  }, [])

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {joints.map(joint => (
            <JointCard
              key={joint.id}
              joint={joint}
              busy={uploading === joint.id}
              msg={msg?.id === joint.id ? msg : null}
              onUpload={file => handleUpload(joint, file)}
              onDelete={() => handleDelete(joint)}
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
}

function JointCard({ joint, busy, msg, onUpload, onDelete }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e0e8f5',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
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
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a4d8a' }}>{joint.code}</div>
        {joint.name && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{joint.name}</div>}
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
