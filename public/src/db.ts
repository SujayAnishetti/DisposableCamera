import { openDB } from 'idb'

export const dbPromise = openDB('photo-upload-queue', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('queue')) {
      db.createObjectStore('queue', { keyPath: 'key', autoIncrement: true })
    }
  }
})

export async function addToQueue(blob: Blob) {
  const db = await dbPromise
  await db.add('queue', { blob })
}

export async function getAllQueued(): Promise<Blob[]> {
  const db = await dbPromise
  const all = await db.getAll('queue') // returns objects like { key, blob }
  return all.map(entry => entry.blob)
}

export async function removeFirstFromQueue() {
  const db = await dbPromise
  const tx = db.transaction('queue', 'readwrite')
  const store = tx.objectStore('queue')
  const cursor = await store.openCursor()
  if (cursor) {
    await cursor.delete()
  }
  await tx.done
}
