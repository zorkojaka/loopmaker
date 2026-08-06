export type Velocity = 0 | 1 | 2

/** Ena skladba/zvok v gridu. `steps` je dolg toliko kot Song.steps. */
export interface Track {
  /** ključ instrumenta, glej instruments.ts */
  voice: string
  name: string
  steps: Velocity[]
  /** 0..1 */
  level: number
  /** polton offset, -12..12 — pri tolkalih deluje kot "tune" */
  tune: number
  /** množitelj dolžine zvoka, 0.2..2 */
  decay: number
  muted: boolean
  soloed: boolean
}

export interface Pattern {
  name: string
  tracks: Track[]
}

export interface Song {
  patterns: Pattern[]
  /** indeks aktivnega patterna */
  current: number
  bpm: number
  /** 0..0.6 — zamik lihih 16-tink */
  swing: number
  /** 0..1 */
  master: number
  steps: number
}
