import { useRef, useState, type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Panel for phones: sits under the 3D view (which shrinks rather than being
 * covered) at one of three heights. Tap the handle to step through them, or
 * drag it to any height — it snaps to the nearest on release.
 */

type Snap = 'peek' | 'half' | 'full'
const ORDER: Snap[] = ['peek', 'half', 'full']
// A tap that moves less than this counts as a tap, not a drag
const TAP_PX = 6
const HEADER_PX = 52

function snapHeight(snap: Snap): number {
  const vh = window.innerHeight
  return snap === 'peek' ? HEADER_PX : snap === 'half' ? Math.round(vh * 0.45) : Math.round(vh * 0.8)
}

export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const [snap, setSnap] = useState<Snap>('half')
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  // The ref drives the gesture (no wait for re-renders between pointer events); state drives the render
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean; height: number } | null>(null)

  const height = dragHeight ?? snapHeight(snap)

  function onPointerDown(e: React.PointerEvent) {
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      // Not capturable; the drag still works while the pointer stays on the handle
    }
    drag.current = { startY: e.clientY, startHeight: height, moved: false, height }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY
    if (Math.abs(dy) > TAP_PX) d.moved = true
    if (d.moved) {
      d.height = Math.min(snapHeight('full'), Math.max(HEADER_PX, d.startHeight + dy))
      setDragHeight(d.height)
    }
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      // Tap: step up, wrapping from full back to peek
      setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length])
    } else {
      const nearest = ORDER.reduce((best, s) =>
        Math.abs(snapHeight(s) - d.height) < Math.abs(snapHeight(best) - d.height) ? s : best,
      )
      setSnap(nearest)
    }
    setDragHeight(null)
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-t-xl border-t bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.15)]',
        dragHeight === null && 'transition-[height] duration-200 ease-out',
      )}
      style={{ height }}
    >
      <button
        type="button"
        className="flex shrink-0 touch-none flex-col items-center gap-1 pt-2 pb-2"
        style={{ height: HEADER_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={`${title}: ${snap === 'full' ? 'collapse' : 'expand'}`}
        aria-expanded={snap !== 'peek'}
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
        <span className="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {title}
          <ChevronUp className={cn('size-3.5 transition-transform', snap === 'full' && 'rotate-180')} aria-hidden />
        </span>
      </button>
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6', snap === 'peek' && 'invisible')}>
        {children}
      </div>
    </aside>
  )
}
