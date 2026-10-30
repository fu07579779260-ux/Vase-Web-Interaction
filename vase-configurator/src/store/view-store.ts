import { create } from 'zustand'

/** View-only state that lives outside the 3D canvas. */
interface ViewStore {
  /** Bumped to ask the camera to frame the vase again */
  fitRequest: number
  requestFit: () => void
}

export const useViewStore = create<ViewStore>()((set) => ({
  fitRequest: 0,
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
}))
