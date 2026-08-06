/** 0 = tišina, 1 = ghost (tiho), 2 = normalno, 3 = akcent */
export type Vel = 0 | 1 | 2 | 3

export interface Step {
  v: Vel
  /** koliko udarcev znotraj enega koraka (roll/ratchet); 1 ali nedefinirano = en */
  roll?: number
}

/** Nota na klavirski mreži. */
export interface Note {
  /** začetek v korakih od začetka loopa */
  step: number
  /** MIDI višina (60 = C4) */
  midi: number
  /** dolžina v korakih */
  len: number
  v: Vel
}

export type LoopKind = 'drum' | 'melody'

/**
 * Ena linija — najmanjša enota, ki jo lahko prižgeš ali ugasneš.
 * Ritmični loop ima korake, melodični note; drugo je skupno.
 */
export interface Loop {
  id: string
  name: string
  color: string
  kind: LoopKind
  /** ključ glasu iz audio/voices.ts */
  voice: string
  /** dolžina v korakih (16 = en takt) */
  length: number
  steps: Step[]
  notes: Note[]
  /** 0..1 */
  level: number
  /** polton offset (pri melodičnih transpozicija) */
  tune: number
  /** množitelj dolžine zvoka, 0.2..2 */
  decay: number
  /** ali loop trenutno igra */
  active: boolean
}

export interface Song {
  loops: Loop[]
  bpm: number
  /** 0..0.6 — zamik lihih 16-tink */
  swing: number
  /** 0..1 */
  master: number
}

export const STEPS_PER_BAR = 16
