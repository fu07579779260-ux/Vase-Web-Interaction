import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MeshData } from '@/geometry/vase-mesh'
import { usePreview } from '@/hooks/use-preview'
import { MATERIALS } from '@/model/materials'
import { useVaseStore } from '@/store/vase-store'

// Edges sharper than this render as hard creases (rim, base, polygon corners up to 14 sides, star tips)
const CREASE_ANGLE = (25 * Math.PI) / 180
const OVERHANG_COLOR = '#ef4444'

/** Just the flagged triangles, as their own geometry, drawn on top of the vase. */
function overlayGeometry(mesh: MeshData, faces: number[]): BufferGeometry | null {
  if (faces.length === 0) return null
  const { positions: P, indices: I } = mesh
  const out = new Float32Array(faces.length * 9)
  let o = 0
  for (const f of faces) {
    for (let k = 0; k < 3; k++) {
      const v = I[3 * f + k] * 3
      out[o++] = P[v]
      out[o++] = P[v + 1]
      out[o++] = P[v + 2]
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(out, 3))
  return g
}

export function VaseMesh({ showOverhangs }: { showOverhangs: boolean }) {
  const material = useVaseStore((s) => s.params.material)
  const color = useVaseStore((s) => s.params.materialColor)
  const { mesh, analysis } = usePreview()

  const geometry = useMemo(() => {
    const indexed = new BufferGeometry()
    indexed.setAttribute('position', new BufferAttribute(mesh.positions, 3))
    indexed.setIndex(new BufferAttribute(mesh.indices, 1))
    const creased = toCreasedNormals(indexed, CREASE_ANGLE)
    indexed.dispose()
    return creased
  }, [mesh])

  const overlay = useMemo(() => overlayGeometry(mesh, analysis.overhangFaces), [mesh, analysis])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => overlay?.dispose(), [overlay])

  const finish = MATERIALS[material].finish

  return (
    <>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={color}
          metalness={0}
          roughness={finish.roughness}
          clearcoat={finish.clearcoat ?? 0}
          clearcoatRoughness={0.1}
          transmission={finish.transmission ?? 0}
          thickness={finish.transmission ? 4 : 0}
          sheen={finish.sheen ?? 0}
          sheenColor={color}
          sheenRoughness={0.8}
        />
      </mesh>
      {showOverhangs && overlay && (
        <mesh geometry={overlay} renderOrder={1}>
          {/* Pulled towards the camera so it wins the depth test against the vase underneath */}
          <meshBasicMaterial
            color={OVERHANG_COLOR}
            transparent
            opacity={0.55}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}
