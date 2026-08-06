import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Engine } from './audio/engine'
import { Board } from './components/Board'
import { ContextMenu } from './components/ContextMenu'
import type { MenuItem, MenuState } from './components/ContextMenu'
import { TopBar } from './components/TopBar'
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

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <TopBar
        song={song}
        playing={playing}
        onToggle={() => void toggle()}
        onBpm={(bpm) => dispatch({ t: 'song', patch: { bpm } })}
        onMix={(patch) => dispatch({ t: 'song', patch })}
      />

      <main className="stage">
        <Board song={song} engine={engine} dispatch={dispatch} openMenu={openMenu} />
      </main>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
