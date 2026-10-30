import { useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addPoint, movePoint, removePoint } from '@/geometry/profile-edit'
import { PRESET_SHAPES, presetControlPoints, profileMultiplier } from '@/geometry/profile'
import { CONTROL_POINT_LIMITS } from '@/model/params'
import { radiusFunction } from '@/geometry/vase-mesh'
import { cn } from '@/lib/utils'
import { useVaseStore } from '@/store/vase-store'

/**
 * Side view of the vase silhouette with draggable control points.
 * Drawn in millimetres at true proportions. Edits the same control points as
 * the presets and zone sliders, so all three stay in sync.
 *
 * - Interior points: drag anywhere (height and width).
 * - Base / rim points: drag sideways to set the bottom / top radius.
 * - Double-click empty space to add a point, a point to remove it.
 * - Keyboard: Tab to a point, arrows to move (Shift = bigger steps), Delete to remove.
 */

const SAMPLES = 160

export function ProfileEditor() {
  const params = useVaseStore((s) => s.params)
  const setParam = useVaseStore((s) => s.setParam)
  const svgRef = useRef<SVGSVGElement>(null)
  // The ref drives the drag (no wait for a re-render between pointer events); the state drives styling
  const dragRef = useRef<number | null>(null)
  const [dragging, setDraggingState] = useState<number | null>(null)
  const setDragging = (i: number | null) => {
    dragRef.current = i
    setDraggingState(i)
  }
  const [selected, setSelected] = useState<number | null>(null)

  const { controlPoints: points, height: H, bottomRadius, topRadius } = params
  const taper = (t: number) => bottomRadius + (topRadius - bottomRadius) * t
  const last = points.length - 1

  const { outline, width } = useMemo(() => {
    const radiusAt = radiusFunction(params)
    const radii = Array.from({ length: SAMPLES + 1 }, (_, i) => radiusAt(i / SAMPLES))
    const handleMax = Math.max(...params.controlPoints.map((p) => p.r * (params.bottomRadius + (params.topRadius - params.bottomRadius) * p.t)))
    const w = Math.max(20, Math.max(...radii, handleMax) * 1.15)
    const y = (i: number) => (H - (i / SAMPLES) * H).toFixed(2)
    const right = radii.map((r, i) => `${r.toFixed(2)},${y(i)}`)
    const left = radii.map((r, i) => `${(-r).toFixed(2)},${y(i)}`).reverse()
    return { outline: `M${right.join('L')}L${left.join('L')}Z`, width: w }
  }, [params, H])

  const pad = Math.max(width, H) * 0.06
  const handleR = Math.max(width * 2, H) / 50
  // Handle positions in mm (y down for SVG)
  const handleX = (i: number) => (i === 0 ? bottomRadius : i === last ? topRadius : taper(points[i].t) * points[i].r)
  const handleY = (i: number) => H - points[i].t * H

  function toModel(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: Math.max(0, p.x), t: Math.min(1, Math.max(0, (H - p.y) / H)) }
  }

  // Event handlers read the store directly, so rapid events never act on a stale render
  const fresh = () => useVaseStore.getState().params
  const freshTaper = (t: number) => {
    const p = fresh()
    return p.bottomRadius + (p.topRadius - p.bottomRadius) * t
  }

  function moveTo(i: number, x: number, t: number) {
    const pts = fresh().controlPoints
    if (i === 0) return setParam('bottomRadius', x)
    if (i === pts.length - 1) return setParam('topRadius', x)
    const next = movePoint(pts, i, t, x / freshTaper(t))
    if (next) setParam('controlPoints', next)
  }

  function remove(i: number) {
    const next = removePoint(fresh().controlPoints, i)
    if (next) {
      setParam('controlPoints', next)
      setSelected(null)
    }
  }

  /** Add a point on the curve, halfway up the largest gap between points. */
  function addInLargestGap() {
    const pts = fresh().controlPoints
    let gap = 0
    for (let i = 1; i < pts.length; i++) if (pts[i].t - pts[i - 1].t > pts[gap + 1].t - pts[gap].t) gap = i - 1
    const t = (pts[gap].t + pts[gap + 1].t) / 2
    // On the current curve, so adding a point doesn't change the shape
    const added = addPoint(pts, t, profileMultiplier(pts)(t))
    if (added) {
      setParam('controlPoints', added.points)
      setSelected(added.index)
    }
  }

  function onKey(i: number, e: React.KeyboardEvent) {
    const big = e.shiftKey ? 5 : 1
    const { controlPoints: pts, bottomRadius: rb, topRadius: rt } = fresh()
    const p = pts[i]
    const x = i === 0 ? rb : i === pts.length - 1 ? rt : freshTaper(p.t) * p.r
    const moves: Record<string, () => void> = {
      ArrowUp: () => moveTo(i, x, p.t + 0.01 * big),
      ArrowDown: () => moveTo(i, x, p.t - 0.01 * big),
      ArrowRight: () => moveTo(i, x + 0.5 * big, p.t),
      ArrowLeft: () => moveTo(i, Math.max(0, x - 0.5 * big), p.t),
      Delete: () => remove(i),
      Backspace: () => remove(i),
    }
    const action = moves[e.key]
    if (action) {
      e.preventDefault()
      action()
    }
  }

  const edited = JSON.stringify(points) !== JSON.stringify(presetControlPoints(params.profilePreset))
  const canAdd = points.length < CONTROL_POINT_LIMITS.maxPoints

  return (
    <div className="space-y-1">
      <svg
        ref={svgRef}
        viewBox={`${-width} ${-pad} ${2 * width} ${H + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-64 w-full touch-none rounded-md border bg-muted/20 select-none"
        role="group"
        aria-label="Profile editor"
        onPointerMove={(e) => {
          const i = dragRef.current
          if (i === null) return
          const m = toModel(e)
          if (m) moveTo(i, m.x, m.t)
        }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onDoubleClick={(e) => {
          const m = toModel(e)
          if (!m) return
          const added = addPoint(fresh().controlPoints, m.t, m.x / freshTaper(m.t))
          if (added) {
            setParam('controlPoints', added.points)
            setSelected(added.index)
          }
        }}
      >
        {/* Axis and print bed */}
        <line x1={0} y1={-pad} x2={0} y2={H + pad} className="stroke-muted-foreground/40" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <line x1={-width} y1={H} x2={width} y2={H} className="stroke-muted-foreground/60" vectorEffect="non-scaling-stroke" />

        <path d={outline} className="fill-foreground/10 stroke-foreground/70" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

        {/* Control polygon, so you can see which handle pulls where */}
        <polyline
          points={points.map((_, i) => `${handleX(i)},${handleY(i)}`).join(' ')}
          className="fill-none stroke-primary/40"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((p, i) => {
          const end = i === 0 || i === last
          const label = i === 0 ? 'Base' : i === last ? 'Rim' : p.role === 'belly' ? 'Belly' : p.role === 'neck' ? 'Neck' : `Point ${i}`
          return (
            <g key={i}>
              <circle
                cx={handleX(i)}
                cy={handleY(i)}
                r={handleR}
                tabIndex={0}
                role="slider"
                aria-label={`${label} point`}
                aria-valuetext={`${(p.t * H).toFixed(1)} mm high, radius ${handleX(i).toFixed(1)} mm`}
                className={cn(
                  'cursor-grab stroke-background outline-none focus-visible:stroke-ring',
                  end ? 'fill-muted-foreground' : p.role ? 'fill-amber-500' : 'fill-primary',
                  (selected === i || dragging === i) && 'stroke-ring',
                  dragging === i && 'cursor-grabbing',
                )}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  try {
                    // Keep receiving moves when the pointer leaves the small handle
                    ;(e.target as Element).setPointerCapture(e.pointerId)
                  } catch {
                    // Some pointer sources can't be captured; the SVG still gets the moves
                  }
                  setDragging(i)
                  setSelected(i)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  remove(i)
                }}
                onFocus={() => setSelected(i)}
                onKeyDown={(e) => onKey(i, e)}
              >
                <title>{label}</title>
              </circle>
              {p.role && (
                <text
                  x={handleX(i) + handleR * 1.6}
                  y={handleY(i)}
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: handleR * 2.2 }}
                >
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {/* Buttons for touch screens, where double-click isn't available */}
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addInLargestGap} disabled={!canAdd}>
          <Plus />
          Add point
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => selected !== null && remove(selected)}
          disabled={selected === null || removePoint(points, selected) === null}
        >
          <Minus />
          Remove point
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {edited ? `Based on ${PRESET_SHAPES[params.profilePreset].label}, edited. ` : ''}
        Drag points · double-click to add or remove · arrow keys to nudge.
      </p>
    </div>
  )
}
