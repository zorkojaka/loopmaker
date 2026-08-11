import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { midiName } from '../audio/instruments'
import { useLoopLines } from '../hooks/useLoopLines'
import { MicRecorder, peaksOf } from '../audio/recorder'
import { declick, mixInto, normalize } from '../audio/take'
import { saveSample } from '../state/samples'
import { LOOP_CHOICES, loopById, makeLoop } from '../state/song'
import type { Action } from '../state/song'
import type { Loop, LoopKind, Song, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'
import type { MenuItem } from './ContextMenu'
import { LoopRow } from './LoopRow'
import { Waveform } from './Waveform'

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
  const registerLine = useLoopLines(engine, song)

  const mic = useRef<MicRecorder | null>(null)
  if (!mic.current) mic.current = new MicRecorder()
  const [micStage, setMicStage] = useState<'off' | 'ready' | 'waiting' | 'recording' | 'error'>('off')
  const [micError, setMicError] = useState('')
  const [recBars, setRecBars] = useState(1)
  const [autoLevel, setAutoLevel] = useState(true)

  const meter = useRef<HTMLElement | null>(null)

  // črtica glasnosti vhoda, dokler je mikrofon povezan
  useEffect(() => {
    if (micStage === 'off' || micStage === 'error') return
    let raf = 0
    const tick = () => {
      if (meter.current) meter.current.style.transform = `scaleX(${Math.min(1, (mic.current?.level() ?? 0) * 1.6)})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [micStage])

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

  /**
   * Posname glas v izbrani loop. `overdub` novo plast prišteje k obstoječi,
   * kar je klasičen looperski prijem za dvoglasje.
   */
  const recordMic = async (overdub = false) => {
    setMicError('')
    try {
      await onEnsurePlaying()
      const ctx = engine.context
      if (!ctx) throw new Error('zvok še ni pripravljen')

      setMicStage('waiting')
      await mic.current!.connect(ctx)

      const pos = engine.position()
      if (pos < 0) throw new Error('ura ne teče')

      // snemanje se začne na začetku naslednjega takta; vmes teče odštevanje
      const startStep = (Math.floor(pos / STEPS_PER_BAR) + 1) * STEPS_PER_BAR
      const startTime = engine.timeOfStep(startStep)
      if (startTime === null) throw new Error('ura ne teče')

      const previous = overdub ? engine.getSample(loop.id) : null
      // plast se mora ujemati z dolžino obstoječega posnetka, ne z izbiro v vrstici
      const length = previous ? loop.length : recBars * STEPS_PER_BAR
      const duration = length * engine.stepDuration
      if (!song.metronome) dispatch({ t: 'song', patch: { metronome: true } })

      const untilStart = Math.max(0, (startTime - ctx.currentTime) * 1000)
      window.setTimeout(() => setMicStage('recording'), untilStart)

      const take = await mic.current!.record(ctx, startTime, duration, loop.offsetMs ?? 0)
      declick(take, ctx.sampleRate)
      if (autoLevel && !previous) normalize(take)

      const data = previous ? mixInto(previous.data, take) : take
      const sample = { data, sampleRate: ctx.sampleRate }
      engine.setSample(loop.id, sample)
      await saveSample(loop.id, sample)
      dispatch({
        t: 'loopPatch',
        id: loop.id,
        patch: { length, peaks: peaksOf(data), recordedBpm: song.bpm, active: true },
      })
      setMicStage('ready')
    } catch (e) {
      setMicError(e instanceof Error ? e.message : String(e))
      setMicStage('error')
    }
  }

  /** Nov glas: svoj loop s svojim gumbom, da lahko glasove plastiš drug ob drugem. */
  const addVoice = () => {
    const fresh = makeLoop('mic', 'sample', { active: false })
    dispatch({ t: 'loopInsert', loop: fresh })
    onSelect(fresh.id)
    setMicStage((stage) => (stage === 'error' ? 'off' : stage))
  }

  const addLoop = (x: number, y: number) => {
    const add = (voice: string, kind: LoopKind) => {
      const fresh = makeLoop(voice, kind, { active: kind !== 'sample' })
      dispatch({ t: 'loopInsert', loop: fresh })
      onSelect(fresh.id)
    }
    const group = (kind: LoopKind) =>
      LOOP_CHOICES.filter((c) => c.kind === kind).map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) }))
    openMenu(x, y, [
      { label: 'Ritem', header: true },
      ...group('drum'),
      { separator: true },
      { label: 'Melodija', header: true },
      ...group('melody'),
      { separator: true },
      { label: 'Posnetek', header: true },
      ...group('sample'),
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

      {loop.kind === 'sample' ? (
        <div className="micpanel" style={{ '--track': loop.color } as CSSProperties}>
          <div className="make__opts">
            <button
              className={`rec${micStage === 'recording' ? ' rec--on' : ''}`}
              disabled={micStage === 'waiting' || micStage === 'recording'}
              onClick={() => void recordMic()}
            >
              <span className="rec__dot" />
              {micStage === 'waiting'
                ? 'ODŠTEVANJE'
                : micStage === 'recording'
                  ? 'SNEMAM'
                  : loop.peaks?.length
                    ? 'POSNEMI ZNOVA'
                    : 'SNEMAJ GLAS'}
            </button>
            {!loop.peaks?.length && (
              <>
                <span className="make__label">Dolžina</span>
                {[1, 2, 4].map((b) => (
                  <button key={b} className={`chip${recBars === b ? ' chip--on' : ''}`} onClick={() => setRecBars(b)}>
                    {b === 1 ? '1 takt' : `${b} takti`}
                  </button>
                ))}
              </>
            )}
            <button className={`chip${autoLevel ? ' chip--on' : ''}`} onClick={() => setAutoLevel((v) => !v)}>
              Samodejna glasnost
            </button>
          </div>

          {loop.peaks?.length ? (
            <div className="make__opts">
              <button
                className="chip chip--wide"
                disabled={micStage === 'waiting' || micStage === 'recording'}
                onClick={() => void recordMic(true)}
              >
                + Dodaj plast na ta glas
              </button>
              <button className="chip" onClick={addVoice}>
                + Nov glas
              </button>
            </div>
          ) : null}

          <div className="meter">
            <i ref={meter} />
          </div>

          <Waveform peaks={loop.peaks ?? []} />

          <label className="slider">
            <span className="slider__label">
              Zamik naprave
              <em>{loop.offsetMs ?? 0} ms</em>
            </span>
            <input
              type="range"
              min={-150}
              max={150}
              step={5}
              value={loop.offsetMs ?? 0}
              onChange={(e) => dispatch({ t: 'loopPatch', id: loop.id, patch: { offsetMs: Number(e.target.value) } })}
            />
          </label>

          <p className="make__note">
            Snemanje se sproži na začetku naslednjega takta, dotlej klika metronom. Če posnetek zveni prezgodaj ali
            prepozno, premakni zamik in posnemi znova. Brez slušalk mikrofon posname tudi zvočnik.
          </p>
          {micError && <p className="make__error">Mikrofon: {micError}</p>}
        </div>
      ) : melodic ? (
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
