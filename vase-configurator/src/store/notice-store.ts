import { create } from 'zustand'

/** One dismissible message for the user (e.g. a share link that couldn't be opened). */
interface NoticeStore {
  message: string | null
  show: (message: string) => void
  dismiss: () => void
}

export const useNoticeStore = create<NoticeStore>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}))
