import { isDirtyNow, useDesignStore } from '@/store/design-store'
import { useVaseStore } from '@/store/vase-store'
import { browserStorage, type KeyValueStore } from './gallery'

/**
 * The working state (parameters + which design is open) survives a reload.
 * Saved per browser; if storage is blocked the app simply starts fresh.
 */

const KEY = 'vase-configurator:session'
const WRITE_DELAY_MS = 400

export function restoreSession(storage: KeyValueStore | null = browserStorage()) {
  if (!storage) return
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return
    const session = JSON.parse(raw) as { params?: unknown; id?: unknown; name?: unknown; dirty?: unknown }
    if (!useVaseStore.getState().loadParams(session.params)) return
    useDesignStore.getState().restore(
      {
        id: typeof session.id === 'string' ? session.id : null,
        name: typeof session.name === 'string' && session.name.trim() ? session.name : 'Untitled vase',
        dirty: typeof session.dirty === 'boolean' ? session.dirty : undefined,
      },
      storage,
    )
  } catch {
    // Damaged session data: start fresh
  }
}

/** Keep writing the session as things change (debounced). Returns an unsubscribe function. */
export function autosaveSession(storage: KeyValueStore | null = browserStorage()): () => void {
  if (!storage) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined

  const write = () => {
    timer = undefined
    try {
      const { id, name } = useDesignStore.getState()
      storage.setItem(KEY, JSON.stringify({ params: useVaseStore.getState().params, id, name, dirty: isDirtyNow() }))
    } catch {
      // Storage full or blocked: the session just won't survive a reload
    }
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(write, WRITE_DELAY_MS)
  }

  const unsubVase = useVaseStore.subscribe(schedule)
  const unsubDesign = useDesignStore.subscribe(schedule)
  return () => {
    clearTimeout(timer)
    unsubVase()
    unsubDesign()
  }
}
