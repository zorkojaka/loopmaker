import { INSTRUMENTS, MELODIC, emptySteps, instrumentOf, melodicOf, parseSteps } from '../audio/instruments'
import type { Alt, Loop, LoopKind, Note, Section, Song, Step, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'

let idSeq = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}`

export const barsOf = (loop: Loop) => Math.max(1, Math.round(loop.length / STEPS_PER_BAR))
export const loopById = (song: Song, id: string | null) => song.loops.find((l) => l.id === id)
export const drumLoops = (song: Song) => song.loops.filter((l) => l.kind === 'drum')

/** Najdaljši loop določa širino mreže v urejevalniku. */
export const gridLength = (song: Song) =>
  Math.max(STEPS_PER_BAR, ...song.loops.filter((l) => l.kind === 'drum').map((l) => l.length))

/** Kopija loopa z novo identiteto — za gumb "Podvoji". */
export function cloneLoop(loop: Loop): Loop {
  return { ...structuredClone(loop), id: uid('l') }
}

/** Posneti loopi nimajo glasu iz knjižnice, zato svoje privzetke. */
const SAMPLE_DEF = { name: 'Glas', color: '#ff9f5a', level: 0.9 }

export function makeLoop(voice: string, kind: LoopKind, opts: Partial<Loop> = {}): Loop {
  const def = kind === 'sample' ? SAMPLE_DEF : kind === 'drum' ? instrumentOf(voice) : melodicOf(voice)
  const length = opts.length ?? STEPS_PER_BAR
  return {
    id: uid('l'),
    name: opts.name ?? def.name,
    color: def.color,
    kind,
    voice,
    length,
    steps: opts.steps ?? emptySteps(length),
    notes: opts.notes ?? [],
    level: opts.level ?? def.level,
    tune: opts.tune ?? 0,
    decay: opts.decay ?? 1,
    active: opts.active ?? true,
  }
}

const drum = (voice: string, pattern: string, active = true, length = STEPS_PER_BAR) =>
  makeLoop(voice, 'drum', { steps: parseSteps(pattern, length), length, active })

/** Skupina not, ki se začnejo hkrati — akord ali posamezen ton. */
const chord = (step: number, midis: number[], len: number, v: Vel = 2): Note[] =>
  midis.map((midi) => ({ step, midi, len, v }))

const melody = (voice: string, name: string, notes: Note[], active = true, length = STEPS_PER_BAR) =>
  makeLoop(voice, 'melody', { notes, name, length, active })

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

export const SECTION_COLORS = ['#6ee7ff', '#ff8fab', '#ffd166', '#a0e548', '#c792ea', '#5ad1c2']

/** Katera kitica teče ob danem globalnem koraku in kje v njej smo. */
export function sectionAt(song: Song, globalStep: number): { section: Section; index: number; barInSection: number } | null {
  if (!song.chainOn || !song.chain.length) return null
  const list = song.chain.map((id) => song.sections.find((s) => s.id === id)).filter((s): s is Section => !!s)
  if (!list.length) return null

  const totalBars = list.reduce((n, s) => n + s.bars, 0)
  let bar = Math.floor(globalStep / STEPS_PER_BAR) % totalBars
  for (let i = 0; i < list.length; i++) {
    if (bar < list[i].bars) return { section: list[i], index: i, barInSection: bar }
    bar -= list[i].bars
  }
  return { section: list[0], index: 0, barInSection: 0 }
}

/**
 * Ali oznaka A/B ustreza temu obhodu loopa: A igra v lihih obhodih (0., 2. …),
 * B v sodih (1., 3. …), nič pa vedno. Tako se par not izmenjuje iz obhoda v obhod.
 */
export const altPlaysOn = (alt: Alt | undefined, cycle: number): boolean =>
  !alt || (alt === 'A') === (cycle % 2 === 0)

/** Ali loop ob tem koraku igra — v zaporedju odloča kitica, sicer stikalo loopa. */
export function loopPlaysAt(song: Song, loop: Loop, globalStep: number): boolean {
  const at = sectionAt(song, globalStep)
  return at ? at.section.loopIds.includes(loop.id) : loop.active
}

export function makeSection(song: Song, name?: string): Section {
  const n = song.sections.length
  return {
    id: uid('s'),
    name: name ?? (n === 0 ? 'Kitica' : n === 1 ? 'Refren' : `Del ${n + 1}`),
    color: SECTION_COLORS[n % SECTION_COLORS.length],
    loopIds: song.loops.filter((l) => l.active).map((l) => l.id),
    bars: 4,
  }
}

export function defaultSong(): Song {
  return {
    sections: [],
    chain: [],
    chainOn: false,
    loops: [
      drum('kick', 'X...x...X.......'),
      drum('snare', '....X.......X...'),
      drum('hat', 'x.o.x.o.x.oxx.o.'),
      drum('openhat', '......x.......x.', false),
      drum('clap', '....X.......X.X.', false),
      drum('bass', 'X..x..X...x..X..'),
      melody('piano', 'Akordi', [...chord(0, [60, 64, 67], 8), ...chord(8, [57, 60, 64], 8)]),
      melody('flute', 'Flavta', [...chord(0, [72], 3), ...chord(4, [76], 3), ...chord(8, [79], 4), ...chord(13, [76], 3)], false),
    ],
    bpm: 96,
    swing: 0.12,
    master: 0.8,
    metronome: false,
  }
}

// --- prevzem starejšega zapisa -------------------------------------------

interface OldTrack {
  voice: string
  name: string
  steps: Step[]
  level?: number
  tune?: number
  decay?: number
}
interface OldMelody {
  voice: string
  name: string
  notes: Note[]
  level?: number
  decay?: number
}
interface OldPattern {
  name: string
  length?: number
  tracks?: OldTrack[]
  melodies?: OldMelody[]
}
interface OldSong {
  patterns?: OldPattern[]
  bpm?: number
  swing?: number
  master?: number
}

/**
 * Star zapis je imel vzorce z devetimi vrstami; nov model pozna samo loope.
 * Vsaka neprazna vrsta postane svoj loop, da uporabnik ne izgubi dela.
 */
export function migrate(old: OldSong): Song {
  const patterns = old.patterns ?? []
  const many = patterns.length > 1
  const loops: Loop[] = []

  patterns.forEach((pattern, pi) => {
    const length = pattern.length ?? STEPS_PER_BAR
    const suffix = many ? ` · ${pattern.name}` : ''

    for (const track of pattern.tracks ?? []) {
      if (!track.steps?.some((s) => s?.v)) continue
      loops.push(
        makeLoop(track.voice, 'drum', {
          name: `${track.name}${suffix}`,
          steps: track.steps,
          length,
          level: track.level,
          tune: track.tune,
          decay: track.decay,
          active: pi === 0,
        }),
      )
    }

    for (const melody of pattern.melodies ?? []) {
      if (!melody.notes?.length) continue
      loops.push(
        makeLoop(melody.voice, 'melody', {
          name: `${melody.name}${suffix}`,
          notes: melody.notes,
          length,
          level: melody.level,
          decay: melody.decay,
          active: pi === 0,
        }),
      )
    }
  })

  if (!loops.length) return defaultSong()
  return { loops, sections: [], chain: [], chainOn: false, bpm: old.bpm ?? 96, swing: old.swing ?? 0.12, master: old.master ?? 0.8, metronome: false }
}

// --- akcije --------------------------------------------------------------

export type Action =
  | { t: 'song'; patch: Partial<Song> }
  | { t: 'loopInsert'; loop: Loop; after?: string }
  | { t: 'loopPatch'; id: string; patch: Partial<Loop> }
  | { t: 'loopToggle'; id: string }
  | { t: 'loopOnly'; id: string }
  | { t: 'loopsAll'; active: boolean }
  | { t: 'loopDelete'; id: string }
  | { t: 'loopClear'; id: string }
  | { t: 'loopLength'; id: string; length: number }
  | { t: 'step'; id: string; step: number; value: Step }
  | { t: 'rowFill'; id: string; every: number; v: Vel }
  | { t: 'noteAdd'; id: string; notes: Note[] }
  | { t: 'noteRemove'; id: string; step: number; midi: number }
  | { t: 'notePatch'; id: string; step: number; midi: number; patch: Partial<Note> }
  | { t: 'noteMove'; id: string; from: { step: number; midi: number }; to: { step: number; midi: number } }
  | { t: 'sectionAdd' }
  | { t: 'sectionPatch'; id: string; patch: Partial<Section> }
  | { t: 'sectionDelete'; id: string }
  | { t: 'sectionApply'; id: string }
  | { t: 'sectionCapture'; id: string }
  | { t: 'chainAdd'; id: string }
  | { t: 'chainRemove'; at: number }
  | { t: 'chainMove'; at: number; by: number }
  | { t: 'reset' }

function mapLoop(song: Song, id: string, fn: (l: Loop) => Loop): Song {
  return { ...song, loops: song.loops.map((l) => (l.id === id ? fn(l) : l)) }
}

/** Nov loop dobi ime z zaporedno številko, če glasbilo že obstaja. */
function uniqueName(song: Song, base: string): string {
  if (!song.loops.some((l) => l.name === base)) return base
  let n = 2
  while (song.loops.some((l) => l.name === `${base} ${n}`)) n++
  return `${base} ${n}`
}

export function reducer(song: Song, a: Action): Song {
  switch (a.t) {
    case 'song':
      return { ...song, ...a.patch }

    case 'loopInsert': {
      const loop = { ...a.loop, name: uniqueName(song, a.loop.name) }
      const src = loopById(song, a.after ?? null)
      const at = src ? song.loops.indexOf(src) + 1 : song.loops.length
      return { ...song, loops: [...song.loops.slice(0, at), loop, ...song.loops.slice(at)] }
    }

    case 'loopPatch':
      return mapLoop(song, a.id, (l) => ({ ...l, ...a.patch }))

    case 'loopToggle':
      return mapLoop(song, a.id, (l) => ({ ...l, active: !l.active }))

    case 'loopOnly':
      return { ...song, loops: song.loops.map((l) => ({ ...l, active: l.id === a.id })) }

    case 'loopsAll':
      return { ...song, loops: song.loops.map((l) => ({ ...l, active: a.active })) }

    case 'loopDelete':
      return { ...song, loops: song.loops.filter((l) => l.id !== a.id) }

    case 'loopClear':
      return mapLoop(song, a.id, (l) => ({ ...l, steps: emptySteps(l.length), notes: [] }))

    case 'loopLength':
      return mapLoop(song, a.id, (l) => ({
        ...l,
        length: a.length,
        // krajšanje odreže konec, daljšanje ponovi obstoječi del
        steps: Array.from({ length: a.length }, (_, i) => l.steps[i % l.steps.length] ?? { v: 0 as Vel }),
        notes: l.notes.filter((n) => n.step < a.length),
      }))

    case 'step':
      return mapLoop(song, a.id, (l) => {
        const cur = l.steps[a.step]
        // brez primerjave oznake A/B bi sprememba izmenjave izpadla kot prazen hod
        const same =
          cur && cur.v === a.value.v && (cur.roll ?? 1) === (a.value.roll ?? 1) && cur.alt === a.value.alt
        if (same) return l
        return { ...l, steps: l.steps.map((s, i) => (i === a.step ? a.value : s)) }
      })

    case 'rowFill':
      return mapLoop(song, a.id, (l) => ({
        ...l,
        steps: l.steps.map((s, i) => (i % a.every === 0 ? { v: a.v } : s)),
      }))

    case 'noteAdd':
      return mapLoop(song, a.id, (l) => ({
        ...l,
        // ista višina na istem koraku obstaja samo enkrat
        notes: [...l.notes.filter((n) => !a.notes.some((x) => x.step === n.step && x.midi === n.midi)), ...a.notes],
      }))

    case 'noteRemove':
      return mapLoop(song, a.id, (l) => ({
        ...l,
        notes: l.notes.filter((n) => !(n.step === a.step && n.midi === a.midi)),
      }))

    case 'notePatch':
      return mapLoop(song, a.id, (l) => ({
        ...l,
        notes: l.notes.map((n) => (n.step === a.step && n.midi === a.midi ? { ...n, ...a.patch } : n)),
      }))

    case 'noteMove':
      return mapLoop(song, a.id, (l) => {
        const moving = l.notes.find((n) => n.step === a.from.step && n.midi === a.from.midi)
        if (!moving) return l
        // nota se premakne na mestu v seznamu, da med vlečenjem ohrani identiteto;
        // če na cilju že kdo stoji, ga premaknjena nota nadomesti
        return {
          ...l,
          notes: l.notes
            .filter((n) => n === moving || !(n.step === a.to.step && n.midi === a.to.midi))
            .map((n) => (n === moving ? { ...n, step: a.to.step, midi: a.to.midi } : n)),
        }
      })

    case 'sectionAdd': {
      const section = makeSection(song)
      return { ...song, sections: [...song.sections, section], chain: [...song.chain, section.id] }
    }

    case 'sectionPatch':
      return { ...song, sections: song.sections.map((s) => (s.id === a.id ? { ...s, ...a.patch } : s)) }

    case 'sectionDelete':
      return {
        ...song,
        sections: song.sections.filter((s) => s.id !== a.id),
        chain: song.chain.filter((id) => id !== a.id),
      }

    case 'sectionApply': {
      // prižgi natanko tiste loope, ki so v kitici
      const section = song.sections.find((s) => s.id === a.id)
      if (!section) return song
      return { ...song, loops: song.loops.map((l) => ({ ...l, active: section.loopIds.includes(l.id) })) }
    }

    case 'sectionCapture':
      return {
        ...song,
        sections: song.sections.map((s) =>
          s.id === a.id ? { ...s, loopIds: song.loops.filter((l) => l.active).map((l) => l.id) } : s,
        ),
      }

    case 'chainAdd':
      return { ...song, chain: [...song.chain, a.id] }

    case 'chainRemove':
      return { ...song, chain: song.chain.filter((_, i) => i !== a.at) }

    case 'chainMove': {
      const to = a.at + a.by
      if (to < 0 || to >= song.chain.length) return song
      const chain = song.chain.slice()
      const [moved] = chain.splice(a.at, 1)
      chain.splice(to, 0, moved)
      return { ...song, chain }
    }

    case 'reset':
      return defaultSong()
  }
}

/** Vsi glasovi, med katerimi lahko izbiraš ob dodajanju loopa. */
export const LOOP_CHOICES = [
  ...INSTRUMENTS.map((i) => ({ voice: i.voice, name: i.name, kind: 'drum' as LoopKind, color: i.color })),
  ...MELODIC.map((i) => ({ voice: i.voice, name: i.name, kind: 'melody' as LoopKind, color: i.color })),
  { voice: 'mic', name: 'Glas (mikrofon)', kind: 'sample' as LoopKind, color: SAMPLE_DEF.color },
]
