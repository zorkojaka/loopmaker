import type { Pattern, Song, Track, Velocity } from '../types'

export const STEPS = 16

export interface InstrumentDef {
  voice: string
  name: string
  color: string
  /** privzeti tune (polton offset) */
  tune: number
  level: number
  /** ali je glas melodičen — takrat tune sliderju pokažemo ime note */
  melodic?: boolean
}

export const INSTRUMENTS: InstrumentDef[] = [
  { voice: 'kick', name: 'Kick', color: '#ff5c7c', tune: 0, level: 1 },
  { voice: 'snare', name: 'Snare', color: '#ffa94d', tune: 0, level: 0.8 },
  { voice: 'clap', name: 'Clap', color: '#ffd43b', tune: 0, level: 0.7 },
  { voice: 'hat', name: 'Hat', color: '#69db7c', tune: 0, level: 0.6 },
  { voice: 'openhat', name: 'Open hat', color: '#38d9a9', tune: 0, level: 0.5 },
  { voice: 'tom', name: 'Tom', color: '#4dabf7', tune: 0, level: 0.7 },
  { voice: 'rim', name: 'Rim', color: '#9775fa', tune: 0, level: 0.6 },
  { voice: 'bass', name: 'Bass', color: '#e599f7', tune: 0, level: 0.9, melodic: true },
  { voice: 'blip', name: 'Blip', color: '#66d9e8', tune: 0, level: 0.6, melodic: true },
]

export const instrumentOf = (voice: string): InstrumentDef =>
  INSTRUMENTS.find((i) => i.voice === voice) ?? INSTRUMENTS[0]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Bas je uglašen na A1 (55 Hz) pri tune=0, blip na A4. */
export function noteName(voice: string, tune: number): string {
  const rootMidi = voice === 'bass' ? 33 : 69
  const midi = rootMidi + Math.round(tune)
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

function emptySteps(): Velocity[] {
  return new Array(STEPS).fill(0) as Velocity[]
}

/** Zapis vzorca v znakih: '.' tišina, 'x' normalno, 'X' akcent. */
function parseSteps(s: string): Velocity[] {
  const out = emptySteps()
  for (let i = 0; i < Math.min(s.length, STEPS); i++) {
    out[i] = s[i] === 'X' ? 2 : s[i] === 'x' ? 1 : 0
  }
  return out
}

function makeTrack(voice: string, pattern = ''): Track {
  const def = instrumentOf(voice)
  return {
    voice,
    name: def.name,
    steps: parseSteps(pattern),
    level: def.level,
    tune: def.tune,
    decay: 1,
    muted: false,
    soloed: false,
  }
}

export function emptyPattern(name: string): Pattern {
  return { name, tracks: INSTRUMENTS.map((i) => makeTrack(i.voice)) }
}

/** Startni beat — da aplikacija ob prvem odprtju takoj nekaj igra. */
function demoPattern(): Pattern {
  return {
    name: 'A',
    tracks: [
      makeTrack('kick', 'X...x...X.......'),
      makeTrack('snare', '....X.......X...'),
      makeTrack('clap', '................'),
      makeTrack('hat', 'x.x.x.x.x.xxx.x.'),
      makeTrack('openhat', '......x.......x.'),
      makeTrack('tom', '................'),
      makeTrack('rim', '................'),
      makeTrack('bass', 'X..x..X...x..X..'),
      makeTrack('blip', '................'),
    ],
  }
}

export function defaultSong(): Song {
  return {
    patterns: [demoPattern(), emptyPattern('B'), emptyPattern('C'), emptyPattern('D')],
    current: 0,
    bpm: 96,
    swing: 0.12,
    master: 0.8,
    steps: STEPS,
  }
}
