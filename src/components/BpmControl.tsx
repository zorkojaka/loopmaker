import { useRef, useState } from 'react'

interface Props {
  bpm: number
  onChange: (bpm: number) => void
}

const clamp = (n: number) => Math.min(240, Math.max(40, Math.round(n)))

/**
 * Tempo: povleci gor/dol za hitro spreminjanje, klikni za vpis številke,
 * TAP pa tempo izmeri iz tvojega trkanja.
 */
export function BpmControl({ bpm, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null)
  const taps = useRef<number[]>([])

  const commit = () => {
    const n = Number(draft)
    if (Number.isFinite(n) && n > 0) onChange(clamp(n))
    setEditing(false)
  }

  const tap = () => {
    const now = performance.now()
    const t = taps.current
    // po sekundi premora začnemo šteti znova
    if (t.length && now - t[t.length - 1] > 2000) t.length = 0
    t.push(now)
    if (t.length > 5) t.shift()
    if (t.length >= 2) {
      const avg = (t[t.length - 1] - t[0]) / (t.length - 1)
      onChange(clamp(60000 / avg))
    }
  }

  return (
    <div className="bpm">
      {editing ? (
        <input
          className="bpm__input"
          type="number"
          inputMode="numeric"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          className="bpm__value"
          title="Povleci gor/dol ali klikni za vpis"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, from: bpm, moved: false }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const delta = Math.round((d.y - e.clientY) / 2)
            if (Math.abs(d.y - e.clientY) > 3) d.moved = true
            if (d.moved) onChange(clamp(d.from + delta))
          }}
          onPointerUp={() => {
            const d = drag.current
            drag.current = null
            if (d && !d.moved) {
              setDraft(String(bpm))
              setEditing(true)
            }
          }}
        >
          <strong>{bpm}</strong>
          <span>BPM</span>
        </button>
      )}
      <button className="bpm__tap" onClick={tap} title="Trkaj v ritmu">
        TAP
      </button>
    </div>
  )
}
