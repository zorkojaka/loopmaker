import { useCallback, useEffect, useRef, useState } from 'react'
import { Engine } from './audio/engine'
import { defaultSong, emptyPattern } from './audio/instruments'
import { Grid } from './components/Grid'
import { Transport } from './components/Transport'
import { TrackEditor } from './components/TrackEditor'
import type { Song, Track, Velocity } from './types'

const STORAGE_KEY = 'loopmaker.song.v1'

function loadSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSong()
    const parsed = JSON.parse(raw) as Song
    if (!parsed?.patterns?.length || !parsed.patterns[0]?.tracks?.length) return defaultSong()
    return parsed
  } catch {
    return defaultSong()
  }
}

export default function App() {
  const [song, setSong] = useState<Song>(loadSong)
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)
  const [selected, setSelected] = useState(0)

  // engine bere vedno najnovejšo skladbo, ne da bi ga bilo treba ustavljati
  const songRef = useRef(song)
  songRef.current = song
  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) engineRef.current = new Engine(() => songRef.current)
  const engine = engineRef.current

  useEffect(() => {
    let raf = 0
    const loop = () => {
      setPlayStep(engine.visualStep())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  useEffect(() => {
    engine.setMaster(song.master)
  }, [engine, song.master])

  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(song)), 300)
    return () => clearTimeout(id)
  }, [song])

  const toggle = useCallback(async () => {
    await engine.toggle()
    setPlaying(engine.playing)
  }, [engine])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        void toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const patchSong = (patch: Partial<Song>) => setSong((s) => ({ ...s, ...patch }))

  const patchTrack = (index: number, patch: Partial<Track>) =>
    setSong((s) => ({
      ...s,
      patterns: s.patterns.map((p, pi) =>
        pi !== s.current ? p : { ...p, tracks: p.tracks.map((t, ti) => (ti === index ? { ...t, ...patch } : t)) },
      ),
    }))

  const setCell = useCallback((track: number, step: number, v: Velocity) => {
    setSong((s) => {
      const pattern = s.patterns[s.current]
      if (pattern.tracks[track].steps[step] === v) return s
      const steps = pattern.tracks[track].steps.slice()
      steps[step] = v
      return {
        ...s,
        patterns: s.patterns.map((p, pi) =>
          pi !== s.current ? p : { ...p, tracks: p.tracks.map((t, ti) => (ti === track ? { ...t, steps } : t)) },
        ),
      }
    })
  }, [])

  const pattern = song.patterns[song.current]
  const track = pattern.tracks[selected]

  const clearPattern = () =>
    setSong((s) => ({
      ...s,
      patterns: s.patterns.map((p, pi) =>
        pi !== s.current ? p : { ...p, tracks: p.tracks.map((t) => ({ ...t, steps: t.steps.map(() => 0 as Velocity) })) },
      ),
    }))

  const copyToNext = () =>
    setSong((s) => {
      const target = (s.current + 1) % s.patterns.length
      const copy = structuredClone(s.patterns[s.current])
      copy.name = s.patterns[target].name
      return { ...s, patterns: s.patterns.map((p, pi) => (pi === target ? copy : p)), current: target }
    })

  const resetAll = () => {
    if (!confirm('Zbrišem vse vzorce in začnem znova?')) return
    const fresh = defaultSong()
    fresh.patterns = fresh.patterns.map((_, i) => (i === 0 ? fresh.patterns[0] : emptyPattern(String.fromCharCode(65 + i))))
    setSong(fresh)
  }

  return (
    <div className="app">
      <Transport
        song={song}
        playing={playing}
        onToggle={() => void toggle()}
        onBpm={(bpm) => patchSong({ bpm: Math.min(200, Math.max(40, bpm)) })}
        onPattern={(i) => patchSong({ current: i })}
      />

      <main className="stage">
        <Grid
          pattern={pattern}
          playStep={playStep}
          selected={selected}
          onSelect={(i) => {
            setSelected(i)
            if (!engine.playing) void engine.preview(i)
          }}
          onCell={setCell}
          onToggleMute={(i) => patchTrack(i, { muted: !pattern.tracks[i].muted })}
        />
        <div className="tools">
          <button onClick={clearPattern}>Zbriši vzorec</button>
          <button onClick={copyToNext}>Kopiraj naprej</button>
          <button onClick={resetAll}>Reset</button>
        </div>
      </main>

      <TrackEditor
        track={track}
        song={song}
        onTrack={(patch) => patchTrack(selected, patch)}
        onSong={patchSong}
        onClearTrack={() => patchTrack(selected, { steps: track.steps.map(() => 0 as Velocity) })}
        onPreview={() => void engine.preview(selected)}
      />
    </div>
  )
}
