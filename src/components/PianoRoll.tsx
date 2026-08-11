import { useRef, useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { isBlackKey, midiName } from '../audio/instruments'
import { usePlayhead } from '../hooks/usePlayhead'
import { longPress } from '../hooks/longPress'
import { chordNotes, diatonicChords } from '../state/song'
import type { Action } from '../state/song'
import type { Alt, Loop, Note, Vel } from '../types'
import type { MenuItem } from './ContextMenu'

interface Props {
  loop: Loop
  engine: Engine
  dispatch: Dispatch<Action>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

const ROWS = 24
/** višina vrstice in razmik — JS in CSS morata biti tu enakih misli */
const ROW_H = 22
const ROW_GAP = 2
const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const LENGTHS = [1, 2, 4, 8]

/** Klavirska mreža: navpično višina tona, vodoravno čas. Akordi so note druga nad drugo. */
/** Okno se ob odprtju postavi tako, da so note loopa vidne. */
function initialLow(loop: Loop): number {
  if (!loop.notes.length) return 48 // C3
  const lowest = Math.min(...loop.notes.map((n) => n.midi))
  const highest = Math.max(...loop.notes.map((n) => n.midi))
  const start = Math.max(lowest - 2, highest - ROWS + 1)
  return Math.min(84, Math.max(24, start))
}

export function PianoRoll({ loop, engine, dispatch, openMenu }: Props) {
  const [low, setLow] = useState(() => initialLow(loop))
  const [len, setLen] = useState(4)
  const [caret, setCaret] = useState(0)
  const [root, setRoot] = useState(0) // C
  const [mode, setMode] = useState<'dur' | 'mol'>('dur')

  const { lineRef, scrollRef, step: playStep } = usePlayhead(engine, loop.length)
  const drag = useRef<{ mode: 'move' | 'resize'; step: number; midi: number; len: number; moved: boolean; note: HTMLElement } | null>(
    null,
  )
  const gridRef = useRef<HTMLDivElement | null>(null)

  const columns: CSSProperties = { gridTemplateColumns: `repeat(${loop.length}, minmax(26px, 1fr))` }
  const rows = Array.from({ length: ROWS }, (_, i) => low + ROWS - 1 - i)
  const chordBase = low + 12 + root

  /**
   * Zloži noto v vidno okno. Pri akordih to pomeni obrat (inverzijo) — ton, ki
   * bi ušel čez rob, se preseli za oktavo niže. Glasbeno je to povsem običajno.
   */
  const fit = (midi: number) => {
    let m = midi
    while (m > low + ROWS - 1) m -= 12
    while (m < low) m += 12
    return m
  }

  const addNotes = (step: number, midis: number[], velocity: Vel = 2) => {
    const fitted = midis.map(fit)
    const notes: Note[] = fitted.map((midi) => ({ step, midi, len, v: velocity }))
    dispatch({ t: 'noteAdd', id: loop.id, notes })
    if (!engine.playing) fitted.forEach((m) => void engine.previewNote(loop.voice, m + loop.tune, loop.level))
  }

  const stampChord = (midis: number[]) => {
    addNotes(caret, midis)
    setCaret((c) => (c + len) % loop.length)
  }

  /**
   * Katera reža mreže je pod prstom. Računamo iz geometrije, ne iz zadetka
   * elementa: nota, ki jo vlečemo, drži prst (pointer capture), zato bi ji
   * moral za `elementFromPoint` odvzeti zadetke — s tem pa bi brskalnik
   * sledenje prstu prekinil.
   */
  const slotAt = (x: number, y: number): { step: number; midi: number } | null => {
    const grid = gridRef.current
    if (!grid) return null
    const r = grid.getBoundingClientRect()
    const step = Math.floor(((x - r.left) / r.width) * loop.length)
    const row = Math.floor((y - r.top) / (ROW_H + ROW_GAP))
    if (step < 0 || step >= loop.length || row < 0 || row >= ROWS) return null
    return { step, midi: low + ROWS - 1 - row }
  }

  const beginDrag = (e: React.PointerEvent, n: Note, mode: 'move' | 'resize') => {
    const target = e.currentTarget as HTMLElement
    const note = target.closest<HTMLElement>('.pnote')
    if (!note) return
    drag.current = { mode, step: n.step, midi: n.midi, len: n.len, moved: false, note }
    target.setPointerCapture?.(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      d.moved = true
      d.note.classList.add('pnote--drag')
    }
    const hit = slotAt(e.clientX, e.clientY)
    if (!hit) return

    if (d.mode === 'move') {
      if (hit.step === d.step && hit.midi === d.midi) return
      dispatch({ t: 'noteMove', id: loop.id, from: { step: d.step, midi: d.midi }, to: hit })
      d.step = hit.step
      d.midi = hit.midi
    } else {
      const len = Math.max(1, Math.min(hit.step - d.step + 1, loop.length - d.step))
      if (len === d.len) return
      d.len = len
      dispatch({ t: 'notePatch', id: loop.id, step: d.step, midi: d.midi, patch: { len } })
    }
  }

  const onDragEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    d.note.classList.remove('pnote--drag')
    // kratek dotik brez premika samo predposluša — brisanje je v meniju
    if (!d.moved && !engine.playing) void engine.previewNote(loop.voice, d.midi + loop.tune, loop.level)
  }

  const noteMenu = (n: Note): MenuItem[] => [
    { label: `${midiName(n.midi)} · korak ${n.step + 1}`, header: true },
    { label: 'Dolžina', header: true },
    ...LENGTHS.map((l) => ({
      label: l === 1 ? '1 korak' : `${l} korakov`,
      checked: n.len === l,
      onClick: () => dispatch({ t: 'notePatch', id: loop.id, step: n.step, midi: n.midi, patch: { len: l } }),
    })),
    { separator: true },
    ...([1, 2, 3] as Vel[]).map((v) => ({
      label: v === 1 ? 'Tiho' : v === 2 ? 'Normalno' : 'Glasno',
      checked: n.v === v,
      onClick: () => dispatch({ t: 'notePatch', id: loop.id, step: n.step, midi: n.midi, patch: { v } }),
    })),
    { separator: true },
    { label: 'Izmenjava med obhodi', header: true },
    ...([
      [undefined, 'Vedno'],
      ['A', 'Samo A (1., 3. obhod)'],
      ['B', 'Samo B (2., 4. obhod)'],
    ] as [Alt | undefined, string][]).map(([alt, label]) => ({
      label,
      checked: n.alt === alt,
      onClick: () => dispatch({ t: 'notePatch', id: loop.id, step: n.step, midi: n.midi, patch: { alt } }),
    })),
    {
      label: 'Naredi par A/B tukaj',
      onClick: () => {
        dispatch({ t: 'notePatch', id: loop.id, step: n.step, midi: n.midi, patch: { alt: 'A' } })
        // druga nota para pristane cel ton više, da se takoj sliši razlika
        dispatch({ t: 'noteAdd', id: loop.id, notes: [{ step: n.step, midi: fit(n.midi + 2), len: n.len, v: n.v, alt: 'B' }] })
      },
    },
    { separator: true },
    { label: 'Izbriši noto', danger: true, onClick: () => dispatch({ t: 'noteRemove', id: loop.id, step: n.step, midi: n.midi }) },
  ]

  const emptyMenu = (step: number, midi: number): MenuItem[] => [
    { label: `${midiName(midi)} · korak ${step + 1}`, header: true },
    { label: 'Akord od te note', header: true },
    { label: 'Dur', onClick: () => addNotes(step, chordNotes(midi, 'dur')) },
    { label: 'Mol', onClick: () => addNotes(step, chordNotes(midi, 'mol')) },
    { label: 'Zmanjšan', onClick: () => addNotes(step, chordNotes(midi, 'zmanjšan')) },
    { separator: true },
    { label: 'Samo ta ton', onClick: () => addNotes(step, [midi]) },
  ]

  return (
    <div className="roll">
      <div className="roll__bar">
        <span className="roll__meta">Oktava</span>
        <button className="chip" onClick={() => setLow((v) => Math.max(24, v - 12))}>
          −8va
        </button>
        <span className="roll__meta">{midiName(low)}</span>
        <button className="chip" onClick={() => setLow((v) => Math.min(84, v + 12))}>
          +8va
        </button>
        <span className="roll__meta roll__meta--gap">Dolžina note</span>
        {LENGTHS.map((l) => (
          <button key={l} className={`chip${len === l ? ' chip--on' : ''}`} onClick={() => setLen(l)}>
            {l}
          </button>
        ))}
      </div>

      <div className="chords">
        <select className="chords__key" value={root} onChange={(e) => setRoot(Number(e.target.value))}>
          {ROOTS.map((r, i) => (
            <option key={r} value={i}>
              {r}
            </option>
          ))}
        </select>
        <div className="chords__mode">
          {(['dur', 'mol'] as const).map((m) => (
            <button key={m} className={`chip${mode === m ? ' chip--on' : ''}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        {diatonicChords(chordBase, mode).map((c) => (
          <button key={c.numeral} className="chord" onClick={() => stampChord(c.notes)}>
            <strong>{ROOTS[c.root % 12]}</strong>
            <em>{c.quality === 'dur' ? '' : c.quality === 'mol' ? 'm' : '°'}</em>
            <span>{c.numeral}</span>
          </button>
        ))}
        <span className="chords__hint">vstavi na korak {caret + 1}</span>
      </div>

      <div className="timeline">
        <div className="timeline__gutter timeline__gutter--keys">
          <div className="gutter__head">Tipke</div>
          {rows.map((midi) => (
            <button
              key={midi}
              className={`key${isBlackKey(midi) ? ' key--black' : ''}`}
              onClick={() => void engine.previewNote(loop.voice, midi + loop.tune, loop.level)}
            >
              {isBlackKey(midi) ? '' : midiName(midi)}
            </button>
          ))}
        </div>

        <div className="timeline__scroll" ref={scrollRef}>
          <div className="timeline__content">
            <div className="ruler" style={columns}>
              {Array.from({ length: loop.length }, (_, i) => (
                <div
                  key={i}
                  className={`tick${i % 4 === 0 ? ' tick--beat' : ''}${i === playStep ? ' tick--play' : ''}`}
                  onClick={() => {
                    setCaret(i)
                    engine.seek(i)
                  }}
                >
                  {i % 4 === 0 ? i / 4 + 1 : ''}
                </div>
              ))}
            </div>

            <div className="rows rows--roll" style={{ gap: ROW_GAP }} ref={gridRef}>
              {rows.map((midi) => (
                <div key={midi} className={`prow${isBlackKey(midi) ? ' prow--black' : ''}`} style={columns}>
                  {Array.from({ length: loop.length }, (_, step) => (
                    <div
                      key={step}
                      data-step={step}
                      data-midi={midi}
                      style={{ height: ROW_H }}
                      className={`pslot${step % 4 === 0 ? ' pslot--beat' : ''}${step === caret ? ' pslot--caret' : ''}${step === playStep ? ' pslot--play' : ''}`}
                      onClick={() => {
                        setCaret(step)
                        addNotes(step, [midi])
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openMenu(e.clientX, e.clientY, emptyMenu(step, midi))
                      }}
                      {...longPress((x, y) => openMenu(x, y, emptyMenu(step, midi)))}
                    />
                  ))}
                </div>
              ))}

              {/*
                Note so v svoji plasti nad mrežo: tako ostane vsaka isti element,
                tudi ko med vlečenjem zamenja vrstico, in prst je ne izgubi.
              */}
              <div className="pnotes">
                {loop.notes.map((n, i) => {
                  const row = low + ROWS - 1 - n.midi
                  if (row < 0 || row >= ROWS) return null
                  const press = longPress((x, y) => openMenu(x, y, noteMenu(n)))
                  return (
                    <div
                      key={i}
                      className={`pnote pnote--v${n.v}`}
                      style={
                        {
                          '--track': loop.color,
                          top: row * (ROW_H + ROW_GAP),
                          height: ROW_H,
                          left: `${(n.step / loop.length) * 100}%`,
                          width: `${(Math.min(n.len, loop.length - n.step) / loop.length) * 100}%`,
                        } as CSSProperties
                      }
                      {...press}
                      onPointerDown={(e) => {
                        press.onPointerDown(e)
                        beginDrag(e, n, 'move')
                      }}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openMenu(e.clientX, e.clientY, noteMenu(n))
                      }}
                    >
                      {n.alt && <span className="pnote__alt">{n.alt}</span>}
                      <span
                        className="pnote__grip"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          beginDrag(e, n, 'resize')
                        }}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragEnd}
                        onPointerCancel={onDragEnd}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="playhead" ref={lineRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
