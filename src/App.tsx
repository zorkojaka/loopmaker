import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Engine } from './audio/engine'
import { Board } from './components/Board'
import { ContextMenu } from './components/ContextMenu'
import type { MenuItem, MenuState } from './components/ContextMenu'
import { MakeView } from './components/MakeView'
import { TopBar } from './components/TopBar'
import type { View } from './components/TopBar'
import { loadSamples, deleteSample } from './state/samples'
import { defaultSong, migrate, reducer } from './state/song'
import type { Song } from './types'

const STORAGE_KEY = 'loopmaker.song.v3'

function loadSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Song
      if (parsed?.loops?.length) return { ...defaultSong(), ...parsed }
    }
    // prva različica s paleto: prevzemi, kar je uporabnik naredil v starem modelu
    const old = localStorage.getItem('loopmaker.song.v2')
    if (old) return migrate(JSON.parse(old))
  } catch {
    // pokvarjen zapis — raje začnemo s privzeto skladbo kot z belim zaslonom
  }
  return defaultSong()
}

export default function App() {
  const [song, dispatch] = useReducer(reducer, undefined, loadSong)
  const [playing, setPlaying] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [view, setView] = useState<View>('make')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // engine bere vedno zadnje stanje, ne da bi ga bilo treba ustavljati
  const songRef = useRef(song)
  songRef.current = song
  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) engineRef.current = new Engine(() => songRef.current)
  const engine = engineRef.current

  useEffect(() => {
    engine.setMaster(song.master)
  }, [engine, song.master])

  // posnetki iz prejšnjih sej — brez njih bi posneti loopi molčali
  useEffect(() => {
    let stale = false
    void loadSamples().then((samples) => {
      if (stale) return
      for (const [id, sample] of samples) engine.setSample(id, sample)
    })
    return () => {
      stale = true
    }
  }, [engine])

  // ko loop izgine, za sabo pospravi še posnetek
  useEffect(() => {
    const ids = new Set(song.loops.map((l) => l.id))
    void loadSamples().then((samples) => {
      for (const id of samples.keys()) {
        if (ids.has(id)) continue
        engine.dropSample(id)
        void deleteSample(id)
      }
    })
  }, [engine, song.loops])

  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(song)), 300)
    return () => clearTimeout(id)
  }, [song])

  const toggle = useCallback(async () => {
    await engine.toggle()
    setPlaying(engine.playing)
  }, [engine])

  const ensurePlaying = useCallback(async () => {
    if (!engine.playing) await engine.start()
    setPlaying(engine.playing)
  }, [engine])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        void toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const openMenu = useCallback((x: number, y: number, items: MenuItem[]) => setMenu({ x, y, items }), [])

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <TopBar
        song={song}
        playing={playing}
        view={view}
        onView={setView}
        onToggle={() => void toggle()}
        onBpm={(bpm) => dispatch({ t: 'song', patch: { bpm } })}
        onMix={(patch) => dispatch({ t: 'song', patch })}
      />

      <main className="stage">
        {view === 'make' ? (
          <MakeView
            song={song}
            engine={engine}
            dispatch={dispatch}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEnsurePlaying={ensurePlaying}
            openMenu={openMenu}
          />
        ) : (
          <Board song={song} engine={engine} dispatch={dispatch} openMenu={openMenu} />
        )}
      </main>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
