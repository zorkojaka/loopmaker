import { useRef } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { longPress } from '../hooks/longPress'
import { midiName } from '../audio/instruments'
import { barsOf, cloneLoop } from '../state/song'
import type { Action } from '../state/song'
import type { Alt, Loop, Vel } from '../types'
import type { MenuItem } from './ContextMenu'
import { PianoRoll } from './PianoRoll'
import { Waveform } from './Waveform'

interface Props {
  loop: Loop
  engine: Engine
  dispatch: Dispatch<Action>
  /** ali loop v tem trenutku res igra (v zaporedju odloča kitica) */
  playing?: boolean
  expanded: boolean
  onExpand: () => void
  /** skok v pogled "Delaj loop" s tem loopom; brez tega se ikona ne izriše */
  onEdit?: () => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  registerLine: (id: string, el: HTMLElement | null) => void
}

const VEL_LABELS: Record<number, string> = { 1: 'Ghost (tiho)', 2: 'Normalno', 3: 'Akcent' }

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider">
      <span className="slider__label">
        {label}
        <em>{display}</em>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/**
 * Ena vrstica = en loop: velik gumb za vklop, ob njem pa mreža, v kateri ga
 * takoj tudi urejaš. Podrobnosti (glasnost, uglasitev, klaviatura) se odprejo
 * pod vrstico, da ni treba nikamor oditi.
 */
export function LoopRow({ loop, engine, dispatch, playing, expanded, onExpand, onEdit, openMenu, registerLine }: Props) {
  const on = playing ?? loop.active
  /** vrednost, ki jo trenutno "barvamo" med vlečenjem; null = ne vlečemo */
  const paint = useRef<Vel | null>(null)
  const melodic = loop.kind === 'melody'
  const sampled = loop.kind === 'sample'
  // enotaktni loop se vedno prilega širini vrstice; daljši dobi drsenje,
  // da koraki ne postanejo premajhni za prst
  const columns: CSSProperties = {
    gridTemplateColumns: `repeat(${loop.length}, minmax(${loop.length > 16 ? '17px' : '0'}, 1fr))`,
  }

  const setStep = (step: number, value: { v: Vel; roll?: number; alt?: Alt }) =>
    dispatch({ t: 'step', id: loop.id, step, value })

  const stepAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)
    const cell = (el as HTMLElement | null)?.closest<HTMLElement>('[data-cell]')
    if (!cell || cell.dataset.loop !== loop.id) return null
    return Number(cell.dataset.step)
  }

  const stepMenu = (step: number): MenuItem[] => {
    const cur = loop.steps[step]
    return [
      { label: `${loop.name} · korak ${step + 1}`, header: true },
      ...([1, 2, 3] as Vel[]).map((v) => ({
        label: VEL_LABELS[v],
        checked: cur.v === v,
        onClick: () => setStep(step, { v, roll: cur.roll }),
      })),
      { separator: true },
      { label: 'Roll (ponovitve v koraku)', header: true },
      ...[1, 2, 3, 4].map((roll) => ({
        label: roll === 1 ? 'Brez' : `×${roll}`,
        checked: (cur.roll ?? 1) === roll,
        onClick: () => setStep(step, { v: cur.v || 2, roll }),
      })),
      { separator: true },
      { label: 'Izmenjava med obhodi', header: true },
      ...([
        [undefined, 'Vedno'],
        ['A', 'Samo A (1., 3. obhod)'],
        ['B', 'Samo B (2., 4. obhod)'],
      ] as [Alt | undefined, string][]).map(([alt, label]) => ({
        label,
        checked: cur.alt === alt,
        onClick: () => setStep(step, { v: cur.v || 2, roll: cur.roll, alt }),
      })),
      { separator: true },
      { label: 'Izbriši korak', onClick: () => setStep(step, { v: 0 }) },
    ]
  }

  const rowMenu = (): MenuItem[] => [
    { label: loop.name, header: true },
    { label: loop.active ? 'Ugasni' : 'Prižgi', onClick: () => dispatch({ t: 'loopToggle', id: loop.id }) },
    { label: 'Samo ta naj igra', onClick: () => dispatch({ t: 'loopOnly', id: loop.id }) },
    {
      label: 'Podvoji',
      onClick: () => dispatch({ t: 'loopInsert', loop: cloneLoop(loop), after: loop.id }),
    },
    {
      label: 'Preimenuj…',
      onClick: () => {
        const name = prompt('Ime loopa', loop.name)
        if (name) dispatch({ t: 'loopPatch', id: loop.id, patch: { name } })
      },
    },
    { separator: true },
    { label: 'Dolžina', header: true },
    ...[16, 32, 64].map((length) => ({
      label: length === 16 ? '1 takt' : `${length / 16} takti`,
      checked: loop.length === length,
      onClick: () => dispatch({ t: 'loopLength', id: loop.id, length }),
    })),
    ...(melodic
      ? [
          { separator: true } as MenuItem,
          { label: 'Oktavo višje', onClick: () => dispatch({ t: 'loopPatch', id: loop.id, patch: { tune: loop.tune + 12 } }) },
          { label: 'Oktavo nižje', onClick: () => dispatch({ t: 'loopPatch', id: loop.id, patch: { tune: loop.tune - 12 } }) },
        ]
      : [
          { separator: true } as MenuItem,
          { label: 'Zapolni vsako 4-tinko', onClick: () => dispatch({ t: 'rowFill', id: loop.id, every: 4, v: 2 }) },
          { label: 'Zapolni vsako 8-tinko', onClick: () => dispatch({ t: 'rowFill', id: loop.id, every: 2, v: 2 }) },
        ]),
    { separator: true },
    { label: 'Počisti', onClick: () => dispatch({ t: 'loopClear', id: loop.id }) },
    { label: 'Izbriši loop', danger: true, onClick: () => dispatch({ t: 'loopDelete', id: loop.id }) },
  ]

  /** Dolžina se vrti 1 → 2 → 4 takte; s tem se izognemo meniju za eno samo izbiro. */
  const cycleLength = () => {
    const next = loop.length === 16 ? 32 : loop.length === 32 ? 64 : 16
    dispatch({ t: 'loopLength', id: loop.id, length: next })
  }

  /** Izbris je edino nepovratno dejanje v vrstici, zato vpraša, kadar je kaj za izgubiti. */
  const remove = () => {
    const hasContent = sampled ? !!loop.peaks?.length : melodic ? loop.notes.length > 0 : loop.steps.some((s) => s.v)
    if (hasContent && !confirm(`Izbrišem loop "${loop.name}"?`)) return
    dispatch({ t: 'loopDelete', id: loop.id })
  }

  const handleDown = (e: React.PointerEvent) => {
    if (melodic || sampled || e.button === 2) return
    const step = stepAt(e.clientX, e.clientY)
    if (step === null) return
    const cur = loop.steps[step]
    // klik kroži prazno → normalno → akcent → prazno; niansa je v dolgem pritisku
    const next: Vel = cur.v === 0 ? 2 : cur.v === 2 ? 3 : 0
    paint.current = next
    setStep(step, { v: next, roll: next ? cur.roll : undefined, alt: next ? cur.alt : undefined })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent) => {
    if (paint.current === null) return
    const step = stepAt(e.clientX, e.clientY)
    if (step !== null) setStep(step, { v: paint.current })
  }

  const summary = sampled
    ? loop.peaks?.length
      ? 'posnetek'
      : 'prazen'
    : melodic
    ? loop.notes.length
      ? `${loop.notes.length} not`
      : 'prazen'
    : loop.steps.some((s) => s.v)
      ? `${loop.steps.filter((s) => s.v).length} udarcev`
      : 'prazen'

  return (
    <div className={`lrow${on ? ' lrow--on' : ''}`} style={{ '--track': loop.color } as CSSProperties}>
      <button
        className="power"
        aria-pressed={loop.active}
        aria-label={`${loop.name}: ${loop.active ? 'ugasni' : 'prižgi'}`}
        onClick={() => dispatch({ t: 'loopToggle', id: loop.id })}
        onContextMenu={(e) => {
          e.preventDefault()
          openMenu(e.clientX, e.clientY, rowMenu())
        }}
        {...longPress((x, y) => openMenu(x, y, rowMenu()))}
      >
        <span className="power__ring" />
        <span className="power__label">{on ? 'IGRA' : 'IZKLOP'}</span>
      </button>

      <div className="lrow__main">
        <div className="lrow__head">
          <span className="lrow__name">{loop.name}</span>
          <span className="lrow__meta">
            {summary} · {barsOf(loop) === 1 ? '1 takt' : `${barsOf(loop)} takti`}
          </span>
          {onEdit && (
            <button className="lrow__btn" onClick={onEdit} aria-label={`Uredi ${loop.name}`} title="Uredi vzorec">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M11.2 2.3 13.7 4.8 5.4 13H3v-2.4z" />
                <path d="M10 3.5 12.5 6" />
              </svg>
            </button>
          )}
          <button className={`lrow__btn${expanded ? ' lrow__btn--on' : ''}`} onClick={onExpand} aria-label="Podrobnosti">
            {expanded ? '⌃' : '⌄'}
          </button>
          <button
            className="lrow__btn lrow__btn--len"
            onClick={cycleLength}
            aria-label={`Dolžina ${barsOf(loop)} ${barsOf(loop) === 1 ? 'takt' : 'takti'}, tap za naslednjo`}
            title="Dolžina loopa"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5" />
              <path d="M11 1.5V5h-3.4M5 14.5V11h3.4" />
            </svg>
            {barsOf(loop)}t
          </button>
          <button className="lrow__btn lrow__btn--danger" onClick={remove} aria-label={`Izbriši ${loop.name}`} title="Izbriši loop">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.2a1 1 0 0 0 1 .8h3.6a1 1 0 0 0 1-.8l.7-8.2" />
            </svg>
          </button>
        </div>

        <div className="lrow__grid">
          <div className="lrow__track">
            {sampled ? (
              <Waveform peaks={loop.peaks ?? []} />
            ) : (
            <div
              className="lrow__cells"
              style={columns}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={() => (paint.current = null)}
              onPointerCancel={() => (paint.current = null)}
            >
              {Array.from({ length: loop.length }, (_, i) => {
                if (melodic) {
                  const starts = loop.notes.filter((n) => n.step === i)
                  const held = loop.notes.some((n) => i > n.step && i < n.step + n.len)
                  return (
                    <div
                      key={i}
                      className={
                        'cell' + (starts.length ? ' cell--v2' : held ? ' cell--v1' : '') + (i % 4 === 0 ? ' cell--beat' : '')
                      }
                      title={starts.map((n) => midiName(n.midi)).join(' ')}
                      onClick={onExpand}
                    >
                      {starts.length > 1 && <span className="cell__roll">{starts.length}</span>}
                    </div>
                  )
                }
                const s = loop.steps[i]
                return (
                  <div
                    key={i}
                    data-cell
                    data-loop={loop.id}
                    data-step={i}
                    className={'cell' + (s?.v ? ` cell--v${s.v}` : '') + (i % 4 === 0 ? ' cell--beat' : '')}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      openMenu(e.clientX, e.clientY, stepMenu(i))
                    }}
                    {...longPress((x, y) => openMenu(x, y, stepMenu(i)))}
                  >
                    {s?.v > 0 && (s.roll ?? 1) > 1 && <span className="cell__roll">{s.roll}</span>}
                  {s?.v > 0 && s.alt && <span className="cell__alt">{s.alt}</span>}
                  </div>
                )
              })}
            </div>
            )}
            <i className="rowline" ref={(el) => registerLine(loop.id, el)} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="lpanel">
          {melodic && <PianoRoll loop={loop} engine={engine} dispatch={dispatch} openMenu={openMenu} />}

          <div className="lpanel__sliders">
            <Slider
              label="Glasnost"
              value={loop.level}
              min={0}
              max={1}
              step={0.01}
              display={`${Math.round(loop.level * 100)}%`}
              onChange={(v) => dispatch({ t: 'loopPatch', id: loop.id, patch: { level: v } })}
            />
            <Slider
              label={melodic ? 'Transpozicija' : 'Tune'}
              value={loop.tune}
              min={-12}
              max={12}
              step={1}
              display={`${loop.tune > 0 ? '+' : ''}${loop.tune}`}
              onChange={(v) => dispatch({ t: 'loopPatch', id: loop.id, patch: { tune: v } })}
            />
            <Slider
              label={melodic ? 'Izzven' : 'Dolžina zvoka'}
              value={loop.decay}
              min={0.2}
              max={2}
              step={0.05}
              display={`${loop.decay.toFixed(2)}×`}
              onChange={(v) => dispatch({ t: 'loopPatch', id: loop.id, patch: { decay: v } })}
            />
          </div>

          <div className="lpanel__actions">
            <span className="lpanel__label">Dolžina loopa</span>
            {[16, 32, 64].map((l) => (
              <button
                key={l}
                className={`chip${loop.length === l ? ' chip--on' : ''}`}
                onClick={() => dispatch({ t: 'loopLength', id: loop.id, length: l })}
              >
                {l / 16} {l === 16 ? 'takt' : 'takti'}
              </button>
            ))}
            <button className="chip" onClick={() => void engine.preview(loop)}>
              Poslušaj
            </button>
            <button className="chip" onClick={() => dispatch({ t: 'loopInsert', loop: cloneLoop(loop), after: loop.id })}>
              Podvoji
            </button>
            <button className="chip" onClick={() => dispatch({ t: 'loopClear', id: loop.id })}>
              Počisti
            </button>
            <button className="chip chip--danger" onClick={() => dispatch({ t: 'loopDelete', id: loop.id })}>
              Izbriši
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
