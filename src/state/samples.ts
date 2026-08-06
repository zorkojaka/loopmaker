/**
 * Posnetki živijo v IndexedDB, ne v localStorage: en takt mono zvoka je nekaj
 * sto kilobajtov, kar bi localStorage (~5 MB in samo besedilo) hitro napolnilo.
 */
const DB_NAME = 'loopmaker'
const STORE = 'samples'

export interface StoredSample {
  data: Float32Array<ArrayBuffer>
  sampleRate: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE)
        const req = run(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function saveSample(id: string, sample: StoredSample): Promise<void> {
  await tx('readwrite', (s) => s.put(sample, id))
}

export async function deleteSample(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

/** Vsi posnetki ob zagonu — engine jih potrebuje, preden karkoli zaigra. */
export async function loadSamples(): Promise<Map<string, StoredSample>> {
  try {
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
    const values = await tx<StoredSample[]>('readonly', (s) => s.getAll())
    const map = new Map<string, StoredSample>()
    keys.forEach((k, i) => map.set(String(k), values[i]))
    return map
  } catch {
    return new Map()
  }
}
