/**
 * Obdelava posnetka, preden postane loop.
 *
 * Vse funkcije so čiste in delajo na mestu tam, kjer je to varno — posnetek je
 * lahko nekaj sto tisoč vzorcev in ga nima smisla po nepotrebnem kopirati.
 */

/** Koliko milisekund zabrisati na začetku in koncu, da rez ne poka. */
const FADE_MS = 6

/**
 * Zabriše robove posnetka. Loop se reže na točnem taktu, kar sredi vala
 * pomeni skok v napetosti — ta se sliši kot klik ob vsakem obhodu.
 */
export function declick(data: Float32Array<ArrayBuffer>, sampleRate: number): Float32Array<ArrayBuffer> {
  const fade = Math.min(Math.floor((FADE_MS / 1000) * sampleRate), Math.floor(data.length / 2))
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    data[i] *= k
    data[data.length - 1 - i] *= k
  }
  return data
}

/** Najglasnejši vzorec v posnetku. */
export function peakOf(data: Float32Array): number {
  let peak = 0
  for (const v of data) {
    const a = Math.abs(v)
    if (a > peak) peak = a
  }
  return peak
}

/**
 * Dvigne posnetek na spodobno glasnost. Glas s telefona je pogosto tih, ker
 * brskalniku prepovemo samodejno ojačenje (to bi med petjem dihalo).
 */
export function normalize(data: Float32Array<ArrayBuffer>, target = 0.9): Float32Array<ArrayBuffer> {
  const peak = peakOf(data)
  if (peak < 0.0005 || peak >= target) return data
  const gain = target / peak
  for (let i = 0; i < data.length; i++) data[i] *= gain
  return data
}

/**
 * Prišteje novo plast k obstoječi (overdub). Vsota se mehko omeji, da glasna
 * druga plast ne zaklipa — tanh zveni bolj naravno kot trdo rezanje.
 */
export function mixInto(base: Float32Array, layer: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(base.length)
  for (let i = 0; i < base.length; i++) {
    const sum = base[i] + (layer[i] ?? 0)
    out[i] = Math.abs(sum) > 0.95 ? Math.tanh(sum) : sum
  }
  return out
}
