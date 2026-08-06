import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Engine } from './audio/engine'
import { ContextMenu } from './components/ContextMenu'
import type { MenuItem, MenuState } from './components/ContextMenu'
import { Inspector } from './components/Inspector'
import { PatternTabs } from './components/PatternTabs'
import { PatternView } from './components/PatternView'
import { SongView } from './components/SongView'
import { TopBar } from './components/TopBar'
import { currentPattern, defaultSong, reducer } from './state/song'
import type { Song } from './types'

const STORAGE_KEY = 'loopmaker.song.v2'

function loadSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSong()
    const parsed = JSON.parse(raw) as Song
    // groba preverba: shema se je med razvojem že spremenila
    if (!parsed?.patterns?.length || !parsed.patterns[0]?.tracks?.[0]?.steps?.[0]) return defaultSong()
    if (typeof parsed.patterns[0].tracks[0].steps[0] !== 'object') return defaultSong()
    return { ...defaultSong(), ...parsed }
  } catch {
    return defaultSong()
  }
}

export default function App() {
  const [song, dispatch] = useReducer(reducer, undefined, loadSong)
  const [playing, setPlaying] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState(0)
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  // engine bere vedno zadnje stanje, ne da bi ga bilo treba ustavljati
  const songRef = useRef(song)
  songRef.current = song
  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) engineRef.current = new Engine(() => songRef.current)
  const engine = engineRef.current

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

  const pattern = currentPattern(song)
  const track = Math.min(selectedTrack, pattern.tracks.length - 1)

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <TopBar
        song={song}
        playing={playing}
        onToggle={() => void toggle()}
        onBpm={(bpm) => dispatch({ t: 'song', patch: { bpm } })}
        onMode={(mode) => dispatch({ t: 'song', patch: { mode } })}
        onMix={(patch) => dispatch({ t: 'song', patch })}
      />

      <PatternTabs song={song} dispatch={dispatch} openMenu={openMenu} />

      <main className="stage">
        {song.mode === 'pattern' ? (
          <PatternView
            pattern={pattern}
            engine={engine}
            dispatch={dispatch}
            selectedTrack={track}
            onSelectTrack={setSelectedTrack}
            openMenu={openMenu}
          />
        ) : (
          <SongView
            song={song}
            engine={engine}
            dispatch={dispatch}
            selectedClip={selectedClip}
            onSelectClip={setSelectedClip}
            openMenu={openMenu}
          />
        )}
      </main>

      <Inspector
        song={song}
        pattern={pattern}
        selectedTrack={track}
        selectedClip={selectedClip}
        engine={engine}
        dispatch={dispatch}
      />

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
