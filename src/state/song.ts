import { INSTRUMENTS, emptySteps, makeTrack, melodicOf } from '../audio/instruments'
import type { Clip, Melody, Note, Pattern, Song, Step, Track, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'

export const PATTERN_COLORS = ['#6ee7ff', '#ff8fab', '#ffd166', '#a0e548', '#c792ea', '#ff9f5a', '#5ad1c2', '#f56565']

let idSeq = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}`

export const barsOf = (p: Pattern) => Math.max(1, Math.round(p.length / STEPS_PER_BAR))
export const patternById = (song: Song, id: string) => song.patterns.find((p) => p.id === id)
export const currentPattern = (song: Song) => patternById(song, song.currentPattern) ?? song.patterns[0]

export function makeMelody(voice: string, notes: Note[] = []): Melody {
  const def = melodicOf(voice)
  return { id: uid('m'), voice, name: def.name, notes, level: def.level, decay: 1, muted: false, soloed: false }
}

function makePattern(name: string, colorIndex: number, rows: string[] = [], melodies: Melody[] = [], length = 16): Pattern {
  return {
    id: uid('p'),
    name,
    color: PATTERN_COLORS[colorIndex % PATTERN_COLORS.length],
    length,
    tracks: INSTRUMENTS.map((inst, i) => makeTrack(inst.voice, rows[i] ?? '', length)),
    melodies: melodies.length ? melodies : [makeMelody('piano'), makeMelody('flute')],
  }
}

/** Akord kot MIDI note: koren + kvaliteta. */
export function chordNotes(root: number, quality: 'dur' | 'mol' | 'zmanjšan'): number[] {
  const third = quality === 'dur' ? 4 : 3
  const fifth = quality === 'zmanjšan' ? 6 : 7
  return [root, root + third, root + fifth]
}

/** Sedem diatoničnih akordov izbrane tonalitete. */
export function diatonicChords(root: number, mode: 'dur' | 'mol') {
  const steps = mode === 'dur' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
  const qualities: ('dur' | 'mol' | 'zmanjšan')[] =
    mode === 'dur'
      ? ['dur', 'mol', 'mol', 'dur', 'dur', 'mol', 'zmanjšan']
      : ['mol', 'zmanjšan', 'dur', 'mol', 'mol', 'dur', 'dur']
  const numerals = mode === 'dur' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
  return steps.map((s, i) => ({
    root: root + s,
    quality: qualities[i],
    numeral: numerals[i],
    notes: chordNotes(root + s, qualities[i]),
  }))
}

/** Skupina not, ki se začnejo hkrati — akord ali posamezen ton. */
const note = (step: number, midis: number[], len: number, v: Vel = 2): Note[] =>
  midis.map((midi) => ({ step, midi, len, v }))

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
  ], [
    // C-dur in a-mol akord, vsak pol takta
    makeMelody('piano', [...note(0, [60, 64, 67], 8), ...note(8, [57, 60, 64], 8)]),
    makeMelody('flute'),
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
  ], [
    makeMelody('piano', [...note(0, [65, 69, 72], 8), ...note(8, [67, 71, 74], 8)]),
    makeMelody('flute', [...note(0, [72], 3), ...note(4, [76], 3), ...note(8, [79], 4), ...note(13, [76], 3)]),
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
  | { t: 'noteAdd'; melody: number; notes: Note[] }
  | { t: 'noteRemove'; melody: number; step: number; midi: number }
  | { t: 'notePatch'; melody: number; step: number; midi: number; patch: Partial<Note> }
  | { t: 'melodyPatch'; melody: number; patch: Partial<Melody> }
  | { t: 'melodyAdd'; voice: string }
  | { t: 'melodyClear'; melody: number }
  | { t: 'melodyDelete'; melody: number }
  | { t: 'melodyTranspose'; melody: number; by: number }
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

function mapMelody(song: Song, index: number, fn: (m: Melody) => Melody): Song {
  return mapCurrent(song, (p) => ({ ...p, melodies: p.melodies.map((m, i) => (i === index ? fn(m) : m)) }))
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

    case 'noteAdd':
      return mapMelody(song, a.melody, (m) => ({
        ...m,
        // ista višina na istem koraku obstaja samo enkrat
        notes: [...m.notes.filter((n) => !a.notes.some((x) => x.step === n.step && x.midi === n.midi)), ...a.notes],
      }))

    case 'noteRemove':
      return mapMelody(song, a.melody, (m) => ({
        ...m,
        notes: m.notes.filter((n) => !(n.step === a.step && n.midi === a.midi)),
      }))

    case 'notePatch':
      return mapMelody(song, a.melody, (m) => ({
        ...m,
        notes: m.notes.map((n) => (n.step === a.step && n.midi === a.midi ? { ...n, ...a.patch } : n)),
      }))

    case 'melodyPatch':
      return mapMelody(song, a.melody, (m) => ({ ...m, ...a.patch }))

    case 'melodyClear':
      return mapMelody(song, a.melody, (m) => ({ ...m, notes: [] }))

    case 'melodyTranspose':
      return mapMelody(song, a.melody, (m) => ({
        ...m,
        notes: m.notes.map((n) => ({ ...n, midi: Math.min(108, Math.max(21, n.midi + a.by)) })),
      }))

    case 'melodyAdd':
      return mapCurrent(song, (p) => ({ ...p, melodies: [...p.melodies, makeMelody(a.voice)] }))

    case 'melodyDelete':
      return mapCurrent(song, (p) => ({ ...p, melodies: p.melodies.filter((_, i) => i !== a.melody) }))

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
