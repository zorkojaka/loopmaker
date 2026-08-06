import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label?: string
  onClick?: () => void
  checked?: boolean
  danger?: boolean
  /** vrstica je naslov skupine, ne ukaz */
  header?: boolean
  separator?: boolean
}

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

/** Kontekstni meni (desni klik na računalniku, dolg pritisk na telefonu). */
export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: state.x, y: state.y })

  // meni obrnemo, če bi štrlel čez rob zaslona
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(state.x, window.innerWidth - r.width - 8),
      y: Math.min(state.y, window.innerHeight - r.height - 8),
    })
  }, [state.x, state.y])

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="menu__sep" />
        ) : item.header ? (
          <div key={i} className="menu__header">
            {item.label}
          </div>
        ) : (
          <button
            key={i}
            className={`menu__item${item.danger ? ' menu__item--danger' : ''}${item.checked ? ' menu__item--checked' : ''}`}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
          >
            <span className="menu__check">{item.checked ? '✓' : ''}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
