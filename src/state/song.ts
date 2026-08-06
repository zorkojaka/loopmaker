import { INSTRUMENTS, emptySteps, makeTrack } from '../audio/instruments'
import type { Clip, Pattern, Song, Step, Track, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'

export const PATTERN_COLORS = ['#6ee7ff', '#ff8fab', '#ffd166', '#a0e548', '#c792ea', '#ff9f5a', '#5ad1c2', '#f56565']

let idSeq = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}`

export const barsOf = (p: Pattern) => Math.max(1, Math.round(p.length / STEPS_PER_BAR))
export const patternById = (song: Song, id: string) => song.patterns.find((p) => p.id === id)
export const currentPattern = (song: Song) => patternById(song, song.currentPattern) ?? song.patterns[0]

function makePattern(name: string, colorIndex: number, rows: string[] = [], length = 16): Pattern {
  return {
    id: uid('p'),
    name,
    color: PATTERN_COLORS[colorIndex % PATTERN_COLORS.length],
    length,
    tracks: INSTRUMENTS.map((inst, i) => makeTrack(inst.voice, rows[i] ?? '', length)),
  }
}

export function defaultSong(): Song {
  const beat = makePattern('Beat', 0, [
    'X...x...X.......',
    '....X.......X...',
    '................',
    'x.o.x.o.x.oxx.o.',
    '......x.......x.',
    '................',
    '................',
    'X..x..X...x..X..',
    '................',
  ])
  const fill = makePattern('Fill', 1, [
    'X.......X...X.X.',
    '....X...x.x.XxXx',
    '................',
    'x.x.x.x.x.x.....',
    '................',
    '........x.x.x.x.',
    '................',
    'X.....X.....X...',
    '................',
  ])
  const hook = makePattern('Hook', 2, [
    'X...x...X...x...',
    '....X.......X...',
    '....x.......x...',
    'x.x.x.x.x.x.x.x.',
    '................',
    '................',
    '................',
    'X..x..X...x..X..',
    'x...x.x...x.x...',
  ])

  const clips: Clip[] = [
    { id: uid('c'), patternId: beat.id, lane: 0, bar: 0 },
    { id: uid('c'), patternId: beat.id, lane: 0, bar: 1 },
    { id: uid('c'), patternId: hook.id, lane: 1, bar: 2 },
    { id: uid('c'), patternId: fill.id, lane: 2, bar: 3 },
  ]

  return {
    patterns: [beat, fill, hook],
    currentPattern: beat.id,
    clips,
    lanes: 5,
    bars: 16,
    mode: 'pattern',
    bpm: 96,
    swing: 0.12,
    master: 0.8,
  }
}

/** Zadnji zaseden takt na časovnici — do sem se skladba vrti. */
export function songLengthBars(song: Song): number {
  let end = 0
  for (const clip of song.clips) {
    const p = patternById(song, clip.patternId)
    if (p) end = Math.max(end, clip.bar + barsOf(p))
  }
  return Math.max(1, end)
}

export function clipAt(song: Song, lane: number, bar: number): Clip | undefined {
  return song.clips.find((c) => {
    const p = patternById(song, c.patternId)
    return !!p && c.lane === lane && bar >= c.bar && bar < c.bar + barsOf(p)
  })
}

// --- akcije --------------------------------------------------------------

export type Action =
  | { t: 'song'; patch: Partial<Song> }
  | { t: 'step'; track: number; step: number; value: Step }
  | { t: 'track'; track: number; patch: Partial<Track> }
  | { t: 'rowClear'; track: number }
  | { t: 'rowFill'; track: number; every: number; v: Vel }
  | { t: 'patternSelect'; id: string }
  | { t: 'patternAdd' }
  | { t: 'patternPatch'; id: string; patch: Partial<Pattern> }
  | { t: 'patternLength'; id: string; length: number }
  | { t: 'patternDuplicate'; id: string }
  | { t: 'patternClear'; id: string }
  | { t: 'patternDelete'; id: string }
  | { t: 'clipPlace'; lane: number; bar: number; patternId: string }
  | { t: 'clipMove'; id: string; lane: number; bar: number }
  | { t: 'clipDelete'; id: string }
  | { t: 'clipDuplicate'; id: string }
  | { t: 'reset' }

/** Preslika trenutni vzorec — vse urejanje mreže gre skozi to pot. */
function mapCurrent(song: Song, fn: (p: Pattern) => Pattern): Song {
  return { ...song, patterns: song.patterns.map((p) => (p.id === song.currentPattern ? fn(p) : p)) }
}

function mapTracks(p: Pattern, index: number, fn: (t: Track) => Track): Pattern {
  return { ...p, tracks: p.tracks.map((t, i) => (i === index ? fn(t) : t)) }
}

export function reducer(song: Song, a: Action): Song {
  switch (a.t) {
    case 'song':
      return { ...song, ...a.patch }

    case 'step':
      return mapCurrent(song, (p) => {
        const cur = p.tracks[a.track].steps[a.step]
        if (cur.v === a.value.v && (cur.roll ?? 1) === (a.value.roll ?? 1)) return p
        return mapTracks(p, a.track, (t) => ({
          ...t,
          steps: t.steps.map((s, i) => (i === a.step ? a.value : s)),
        }))
      })

    case 'track':
      return mapCurrent(song, (p) => mapTracks(p, a.track, (t) => ({ ...t, ...a.patch })))

    case 'rowClear':
      return mapCurrent(song, (p) => mapTracks(p, a.track, (t) => ({ ...t, steps: emptySteps(p.length) })))

    case 'rowFill':
      return mapCurrent(song, (p) =>
        mapTracks(p, a.track, (t) => ({
          ...t,
          steps: t.steps.map((s, i) => (i % a.every === 0 ? { v: a.v } : s)),
        })),
      )

    case 'patternSelect':
      return { ...song, currentPattern: a.id }

    case 'patternAdd': {
      const p = makePattern(`Vzorec ${song.patterns.length + 1}`, song.patterns.length)
      return { ...song, patterns: [...song.patterns, p], currentPattern: p.id }
    }

    case 'patternPatch':
      return { ...song, patterns: song.patterns.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) }

    case 'patternLength':
      return {
        ...song,
        patterns: song.patterns.map((p) => {
          if (p.id !== a.id) return p
          return {
            ...p,
            length: a.length,
            tracks: p.tracks.map((t) => ({
              ...t,
              // krajšanje odreže konec, daljšanje ponovi obstoječi del
              steps: Array.from({ length: a.length }, (_, i) => t.steps[i % t.steps.length] ?? { v: 0 as Vel }),
            })),
          }
        }),
      }

    case 'patternDuplicate': {
      const src = patternById(song, a.id)
      if (!src) return song
      const copy: Pattern = {
        ...structuredClone(src),
        id: uid('p'),
        name: `${src.name} 2`,
        color: PATTERN_COLORS[song.patterns.length % PATTERN_COLORS.length],
      }
      return { ...song, patterns: [...song.patterns, copy], currentPattern: copy.id }
    }

    case 'patternClear':
      return {
        ...song,
        patterns: song.patterns.map((p) =>
          p.id === a.id ? { ...p, tracks: p.tracks.map((t) => ({ ...t, steps: emptySteps(p.length) })) } : p,
        ),
      }

    case 'patternDelete': {
      if (song.patterns.length <= 1) return song
      const patterns = song.patterns.filter((p) => p.id !== a.id)
      return {
        ...song,
        patterns,
        clips: song.clips.filter((c) => c.patternId !== a.id),
        currentPattern: song.currentPattern === a.id ? patterns[0].id : song.currentPattern,
      }
    }

    case 'clipPlace': {
      const p = patternById(song, a.patternId)
      if (!p) return song
      const span = barsOf(p)
      // najprej umakni vse, kar bi se prekrivalo
      const clips = song.clips.filter((c) => {
        if (c.lane !== a.lane) return true
        const cp = patternById(song, c.patternId)
        const cSpan = cp ? barsOf(cp) : 1
        return c.bar + cSpan <= a.bar || c.bar >= a.bar + span
      })
      return { ...song, clips: [...clips, { id: uid('c'), patternId: a.patternId, lane: a.lane, bar: a.bar }] }
    }

    case 'clipMove': {
      const moving = song.clips.find((c) => c.id === a.id)
      if (!moving) return song
      const p = patternById(song, moving.patternId)
      const span = p ? barsOf(p) : 1
      const clips = song.clips.filter((c) => {
        if (c.id === a.id || c.lane !== a.lane) return true
        const cp = patternById(song, c.patternId)
        const cSpan = cp ? barsOf(cp) : 1
        return c.bar + cSpan <= a.bar || c.bar >= a.bar + span
      })
      return { ...song, clips: clips.map((c) => (c.id === a.id ? { ...c, lane: a.lane, bar: a.bar } : c)) }
    }

    case 'clipDelete':
      return { ...song, clips: song.clips.filter((c) => c.id !== a.id) }

    case 'clipDuplicate': {
      const src = song.clips.find((c) => c.id === a.id)
      if (!src) return song
      const p = patternById(song, src.patternId)
      const span = p ? barsOf(p) : 1
      return { ...song, clips: [...song.clips, { ...src, id: uid('c'), bar: src.bar + span }] }
    }

    case 'reset':
      return defaultSong()
  }
}
