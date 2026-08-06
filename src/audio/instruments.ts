import type { Step, Track, Vel } from '../types'

export interface InstrumentDef {
  voice: string
  name: string
  color: string
  tune: number
  level: number
  /** melodičnim glasovom pri tune prikažemo ime note namesto polutonov */
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

/** Melodični kanali — igrajo se v piano rollu, ne v ritmični mreži. */
export const MELODIC: InstrumentDef[] = [
  { voice: 'piano', name: 'Klavir', color: '#ffe066', tune: 0, level: 0.75, melodic: true },
  { voice: 'flute', name: 'Flavta', color: '#8ce99a', tune: 0, level: 0.7, melodic: true },
  { voice: 'strings', name: 'Godala', color: '#a5b4fc', tune: 0, level: 0.7, melodic: true },
  { voice: 'pluck', name: 'Brenkalo', color: '#f8a8c8', tune: 0, level: 0.7, melodic: true },
  { voice: 'organ', name: 'Orgle', color: '#7ad7f0', tune: 0, level: 0.6, melodic: true },
]

export const melodicOf = (voice: string): InstrumentDef =>
  MELODIC.find((i) => i.voice === voice) ?? MELODIC[0]

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Ime MIDI note, npr. 60 → C4. */
export const midiName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`

/** Ali je nota črna tipka. */
export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)

/** Bas je pri tune=0 uglašen na A1 (55 Hz), Blip na A4. */
export function noteName(voice: string, tune: number): string {
  const rootMidi = voice === 'bass' ? 33 : 69
  const midi = rootMidi + Math.round(tune)
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export function emptySteps(length: number): Step[] {
  return Array.from({ length }, () => ({ v: 0 as Vel }))
}

/** Zapis vzorca v znakih: '.' tišina, 'o' ghost, 'x' normalno, 'X' akcent. */
export function parseSteps(s: string, length: number): Step[] {
  return Array.from({ length }, (_, i) => {
    const c = s[i]
    return { v: (c === 'X' ? 3 : c === 'x' ? 2 : c === 'o' ? 1 : 0) as Vel }
  })
}

export function makeTrack(voice: string, pattern = '', length = 16): Track {
  const def = instrumentOf(voice)
  return {
    voice,
    name: def.name,
    steps: parseSteps(pattern, length),
    level: def.level,
    tune: def.tune,
    decay: 1,
    muted: false,
    soloed: false,
  }
}
