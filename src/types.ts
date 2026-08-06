/** 0 = tišina, 1 = ghost (tiho), 2 = normalno, 3 = akcent */
export type Vel = 0 | 1 | 2 | 3

export interface Step {
  v: Vel
  /** koliko udarcev znotraj enega koraka (roll/ratchet); 1 ali nedefinirano = en */
  roll?: number
}

export interface Track {
  /** ključ instrumenta, glej audio/instruments.ts */
  voice: string
  name: string
  steps: Step[]
  /** 0..1 */
  level: number
  /** polton offset, -12..12 */
  tune: number
  /** množitelj dolžine zvoka, 0.2..2 */
  decay: number
  muted: boolean
  soloed: boolean
}

/** Nota na klavirski mreži. */
export interface Note {
  /** začetek v korakih od začetka vzorca */
  step: number
  /** MIDI višina (60 = C4) */
  midi: number
  /** dolžina v korakih */
  len: number
  v: Vel
}

/** Melodični kanal — akordi in melodije, urejani v piano rollu. */
export interface Melody {
  id: string
  voice: string
  name: string
  notes: Note[]
  level: number
  /** množitelj izzvena */
  decay: number
  muted: boolean
  soloed: boolean
}

export interface Pattern {
  id: string
  name: string
  color: string
  /** dolžina v korakih (16 = en takt) */
  length: number
  tracks: Track[]
  melodies: Melody[]
}

/** Blok vzorca na časovnici skladbe. */
export interface Clip {
  id: string
  patternId: string
  /** vrstica na časovnici */
  lane: number
  /** začetek v taktih */
  bar: number
}

export type Mode = 'pattern' | 'song'

export interface Song {
  patterns: Pattern[]
  currentPattern: string
  clips: Clip[]
  /** število vrstic na časovnici */
  lanes: number
  /** dolžina časovnice v taktih */
  bars: number
  mode: Mode
  bpm: number
  /** 0..0.6 — zamik lihih 16-tink */
  swing: number
  /** 0..1 */
  master: number
}

export const STEPS_PER_BAR = 16
