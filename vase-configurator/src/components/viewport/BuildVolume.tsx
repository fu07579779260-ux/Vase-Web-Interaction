import { useEffect, useMemo } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { Theme } from '@/hooks/use-theme'
import { useVaseStore } from '@/store/vase-store'

const COLORS: Record<Theme, string> = { dark: '#6b7280', light: '#9ca3af' }

/** Wireframe of the printer's build volume, centred on the vase, resting on the bed. */
export function BuildVolume({ theme }: { theme: Theme }) {
  const x = useVaseStore((s) => s.params.buildX)
  const y = useVaseStore((s) => s.params.buildY)
  const z = useVaseStore((s) => s.params.buildZ)

  // Printer X/Y are the bed, Z is up; in the scene Y is up
  const edges = useMemo(() => {
    const box = new BoxGeometry(x, z, y)
    const e = new EdgesGeometry(box)
    box.dispose()
    return e
  }, [x, y, z])

  useEffect(() => () => edges.dispose(), [edges])

  return (
    <lineSegments geometry={edges} position={[0, z / 2, 0]}>
      <lineBasicMaterial color={COLORS[theme]} transparent opacity={0.6} />
    </lineSegments>
  )
}
