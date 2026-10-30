import { create } from 'zustand'
import type { VaseParams } from '@/model/params'
import {
  browserStorage,
  getDesign,
  saveDesign,
  type KeyValueStore,
  type SavedDesign,
} from '@/persistence/gallery'
import { captureThumbnail } from '@/persistence/thumbnail'
import { useVaseStore } from './vase-store'

/**
 * Which saved design is open, its name, and what was last saved — so the UI
 * can show unsaved changes. The parameters themselves live in the vase store.
 */

export const UNTITLED = 'Untitled vase'

interface DesignStore {
  /** Gallery id of the open design; null for a design never saved */
  id: string | null
  name: string
  /** The params object as of the last save/open; the store replaces params on every change */
  savedParams: VaseParams | null
  savedName: string
  setName: (name: string) => void
  /** Save over the open design (or as a new one). Returns null if the browser refused. */
  save: (storage?: KeyValueStore | null) => SavedDesign | null
  /** Open a saved design. Returns false if it's missing or its data is invalid. */
  open: (id: string, storage?: KeyValueStore | null) => boolean
  /** Start over from the default vase. */
  newDesign: () => void
  /** Load parameters from outside (file or link) as a new, unsaved design. */
  importDesign: (name: string, params: unknown) => boolean
  /**
   * Restore id/name after a reload. `dirty` is what the session recorded; without
   * it (older sessions) the design counts as clean only if it matches its saved copy.
   */
  restore: (session: { id: string | null; name: string; dirty?: boolean }, storage?: KeyValueStore | null) => void
}

export const useDesignStore = create<DesignStore>()((set, get) => {
  return {
    id: null,
    name: UNTITLED,
    savedParams: useVaseStore.getState().params,
    savedName: UNTITLED,

    setName: (name) => set({ name }),

    save: (storage) => {
      const params = useVaseStore.getState().params
      const saved = saveDesign(
        { id: get().id, name: get().name, params, thumbnail: captureThumbnail() },
        storage === undefined ? browserStorage() : storage,
      )
      if (saved) set({ id: saved.id, name: saved.name, savedParams: params, savedName: saved.name })
      return saved
    },

    open: (id, storage) => {
      const design = getDesign(id, storage === undefined ? browserStorage() : storage)
      if (!design || !useVaseStore.getState().loadParams(design.params)) return false
      set({ id: design.id, name: design.name, savedParams: useVaseStore.getState().params, savedName: design.name })
      return true
    },

    newDesign: () => {
      useVaseStore.getState().reset()
      set({ id: null, name: UNTITLED, savedParams: useVaseStore.getState().params, savedName: UNTITLED })
    },

    importDesign: (name, params) => {
      if (!useVaseStore.getState().loadParams(params)) return false
      // Not in the gallery yet, so it counts as unsaved until the user saves it
      set({ id: null, name, savedParams: null, savedName: UNTITLED })
      return true
    },

    restore: ({ id, name, dirty }, storage) => {
      const params = useVaseStore.getState().params
      const saved = id ? getDesign(id, storage === undefined ? browserStorage() : storage) : undefined
      const clean =
        dirty !== undefined ? !dirty : saved !== undefined && JSON.stringify(saved.params) === JSON.stringify(params)
      set({
        id: saved ? id : null,
        name,
        savedParams: clean ? params : null,
        savedName: clean ? name : (saved?.name ?? UNTITLED),
      })
    },
  }
})

/** Whether the parameters or the name differ from the last save (non-reactive). */
export function isDirtyNow(): boolean {
  const { savedParams, name, savedName } = useDesignStore.getState()
  return useVaseStore.getState().params !== savedParams || name !== savedName
}

/** True when the parameters or the name differ from the last save. */
export function useIsDirty(): boolean {
  const params = useVaseStore((s) => s.params)
  const { savedParams, name, savedName } = useDesignStore()
  return params !== savedParams || name !== savedName
}
