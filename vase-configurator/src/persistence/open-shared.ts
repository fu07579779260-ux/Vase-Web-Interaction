import { isDirtyNow, useDesignStore } from '@/store/design-store'
import { useNoticeStore } from '@/store/notice-store'
import { decodeShareHash, isShareHash } from './share-link'

const UNSAVED_PROMPT = 'Open the shared design? Your unsaved changes will be lost.'

/**
 * If the address contains a share link, open that design as a new, unsaved
 * one. The hash is removed afterwards, so a reload keeps your later edits
 * instead of re-opening the link. Returns true if a design was opened.
 */
export function openSharedLink(
  location: Pick<Location, 'hash' | 'pathname' | 'search'> = window.location,
  confirmDiscard: (message: string) => boolean = (m) => window.confirm(m),
  clearHash: () => void = () => history.replaceState(null, '', location.pathname + location.search),
): boolean {
  if (!isShareHash(location.hash)) return false
  const result = decodeShareHash(location.hash)
  clearHash()

  if (!result.ok) {
    useNoticeStore.getState().show(`Couldn’t open the shared design: ${result.error}`)
    return false
  }
  if (isDirtyNow() && !confirmDiscard(UNSAVED_PROMPT)) return false
  return useDesignStore.getState().importDesign(result.name, result.params)
}

/** Also react when a link is pasted into an already-open tab. */
export function watchSharedLinks(): () => void {
  const onHash = () => openSharedLink()
  window.addEventListener('hashchange', onHash)
  return () => window.removeEventListener('hashchange', onHash)
}
