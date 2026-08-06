import { useRef, useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { midiName } from '../audio/instruments'
import { useLoopLines } from '../hooks/useLoopLines'
import { LOOP_CHOICES, loopById, makeLoop } from '../state/song'
import type { Action } from '../state/song'
import type { Loop, Song, Vel } from '../types'
import type { MenuItem } from './ContextMenu'
import { LoopRow } from './LoopRow'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  selectedId: string | null
  onSelect: (id: string) => void
  /** poskrbi, da ura teče (in da to ve tudi gumb za predvajanje) */
  onEnsurePlaying: () => Promise<void>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/** Kvantizacija: na koliko korakov se pripne udarec. */
const QUANTIZE = [
  { steps: 1, label: '1/16' },
  { steps: 2, label: '1/8' },
  { steps: 4, label: '1/4' },
]

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SCALE = { dur: [0, 2, 4, 5, 7, 9, 11, 12], mol: [0, 2, 3, 5, 7, 8, 10, 12] }

/**
 * Prvi pogled: tu loop nastane. Loop se vrti, ti pa vanj tapkaš v ritmu —
 * udarec se pripne na najbližji korak izbrane kvantizacije. Kar zgrešiš,
 * popraviš s prstom kar v mreži pod ploščicami.
 */
export function MakeView({ song, engine, dispatch, selectedId, onSelect, onEnsurePlaying, openMenu }: Props) {
  const [armed, setArmed] = useState(false)
  const [quant, setQuant] = useState(1)
  const [accent, setAccent] = useState(false)
  const [noteLen, setNoteLen] = useState(2)
  const [root, setRoot] = useState(0)
  const [mode, setMode] = useState<'dur' | 'mol'>('dur')
  const [octave, setOctave] = useState(4)
  const [flash, setFlash] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const flashTimer = useRef<number | null>(null)
  const registerLine = useLoopLines(engine, song.loops)

  const loop = loopById(song, selectedId) ?? song.loops[0]
  if (!loop) return null
  const melodic = loop.kind === 'melody'

  const blink = (i: number) => {
    setFlash(i)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 130)
  }

  /** Kam v loopu pade udarec, ki se je zgodil zdaj. */
  const stepNow = (target: Loop): number | null => {
    const pos = engine.position()
    if (pos < 0) return null
    return (Math.round(pos / quant) * quant) % target.length
  }

  const tapDrum = () => {
    blink(0)
    void engine.preview(loop, accent ? 3 : 2)
    if (!armed) return
    const step = stepNow(loop)
    if (step === null) return
    dispatch({ t: 'step', id: loop.id, step, value: { v: (accent ? 3 : 2) as Vel } })
  }

  const tapNote = (midi: number, pad: number) => {
    blink(pad)
    void engine.previewNote(loop.voice, midi + loop.tune, loop.level, noteLen * (60 / song.bpm / 4))
    if (!armed) return
    const step = stepNow(loop)
    if (step === null) return
    dispatch({ t: 'noteAdd', id: loop.id, notes: [{ step, midi, len: noteLen, v: (accent ? 3 : 2) as Vel }] })
  }

  const arm = async () => {
    const next = !armed
    setArmed(next)
    // snemanje brez teka ure nima smisla — če ne igra, kar poženemo
    if (next) await onEnsurePlaying()
  }

  const addLoop = (x: number, y: number) => {
    const add = (voice: string, kind: 'drum' | 'melody') => {
      const fresh = makeLoop(voice, kind, { active: true })
      dispatch({ t: 'loopInsert', loop: fresh })
      onSelect(fresh.id)
    }
    openMenu(x, y, [
      { label: 'Ritem', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'drum').map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) })),
      { separator: true },
      { label: 'Melodija', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'melody').map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) })),
    ])
  }

  const scale = SCALE[mode].map((s) => 12 * (octave + 1) + root + s)

  return (
    <div className="make">
      <div className="make__loops">
        {song.loops.map((l) => (
          <button
            key={l.id}
            className={`lchip${l.id === loop.id ? ' lchip--on' : ''}`}
            style={{ '--track': l.color } as CSSProperties}
            onClick={() => onSelect(l.id)}
          >
            <span className="lchip__dot" />
            {l.name}
          </button>
        ))}
        <button className="lchip lchip--add" onClick={(e) => addLoop(e.clientX, e.clientY)}>
          + nov
        </button>
      </div>

      <div className="make__rec">
        <button className={`rec${armed ? ' rec--on' : ''}`} onClick={() => void arm()}>
          <span className="rec__dot" />
          {armed ? 'SNEMA' : 'SNEMAJ'}
        </button>

        <div className="make__opts">
          <span className="make__label">Kvantiziraj</span>
          {QUANTIZE.map((q) => (
            <button key={q.steps} className={`chip${quant === q.steps ? ' chip--on' : ''}`} onClick={() => setQuant(q.steps)}>
              {q.label}
            </button>
          ))}
          <button className={`chip${accent ? ' chip--on' : ''}`} onClick={() => setAccent((v) => !v)}>
            Akcent
          </button>
          <button
            className={`chip${song.metronome ? ' chip--on' : ''}`}
            onClick={() => dispatch({ t: 'song', patch: { metronome: !song.metronome } })}
          >
            Metronom
          </button>
          <button className="chip" onClick={() => dispatch({ t: 'loopClear', id: loop.id })}>
            Počisti
          </button>
        </div>
      </div>

      {melodic ? (
        <>
          <div className="make__opts make__opts--scale">
            <select className="chords__key" value={root} onChange={(e) => setRoot(Number(e.target.value))}>
              {ROOTS.map((r, i) => (
                <option key={r} value={i}>
                  {r}
                </option>
              ))}
            </select>
            {(['dur', 'mol'] as const).map((m) => (
              <button key={m} className={`chip${mode === m ? ' chip--on' : ''}`} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
            <button className="chip" onClick={() => setOctave((o) => Math.max(1, o - 1))}>
              −8va
            </button>
            <span className="make__label">C{octave}</span>
            <button className="chip" onClick={() => setOctave((o) => Math.min(7, o + 1))}>
              +8va
            </button>
            <span className="make__label">Dolžina note</span>
            {[1, 2, 4, 8].map((l) => (
              <button key={l} className={`chip${noteLen === l ? ' chip--on' : ''}`} onClick={() => setNoteLen(l)}>
                {l}
              </button>
            ))}
          </div>

          <div className="pads" style={{ '--track': loop.color } as CSSProperties}>
            {scale.map((midi, i) => (
              <button key={midi} className={`pad${flash === i ? ' pad--hit' : ''}`} onPointerDown={() => tapNote(midi, i)}>
                {midiName(midi)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          className={`bigpad${flash === 0 ? ' bigpad--hit' : ''}`}
          style={{ '--track': loop.color } as CSSProperties}
          onPointerDown={tapDrum}
        >
          <span className="bigpad__name">{loop.name}</span>
          <span className="bigpad__hint">{armed ? 'tapkaj v ritmu — udarci se zapisujejo' : 'tapkaj za poslušanje'}</span>
        </button>
      )}

      <LoopRow
        loop={loop}
        engine={engine}
        dispatch={dispatch}
        expanded={expanded}
        onExpand={() => setExpanded((v) => !v)}
        openMenu={openMenu}
        registerLine={registerLine}
      />

      <p className="make__note">
        Snemanje z mikrofona telefona pride v to isto okno — posneta linija bo loop kot vsak drug.
      </p>
    </div>
  )
}
