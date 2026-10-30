import { useCallback, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { vaseSize } from '@/geometry/bounds'
import { useVaseStore } from '@/store/vase-store'
import { useViewStore } from '@/store/view-store'

// Breathing room around the vase
const MARGIN = 1.2
const DEFAULT_DIRECTION = new Vector3(1, 0.7, 1).normalize()

// The part of drei's OrbitControls this needs
type Orbit = { target: Vector3; update(): void }

/**
 * Frames the whole vase, whatever the canvas shape: on load, whenever the
 * canvas is resized (phone rotation, bottom sheet), and on request (Fit button / F key).
 * Keeps the current viewing direction; only distance and target change.
 */
export function FitCamera() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Orbit | null
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const fitRequest = useViewStore((s) => s.fitRequest)

  const fit = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls || width === 0 || height === 0) return
    const { diameter, height: h } = vaseSize(useVaseStore.getState().params)
    const radius = 0.5 * Math.hypot(diameter, h) // sphere around the vase
    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (width / height))
    const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * MARGIN

    const target = new Vector3(0, h / 2, 0)
    const direction = camera.position.clone().sub(controls.target)
    if (direction.lengthSq() < 1e-6) direction.copy(DEFAULT_DIRECTION)
    direction.normalize()

    controls.target.copy(target)
    camera.position.copy(target).addScaledVector(direction, distance)
    camera.far = Math.max(5000, distance * 10)
    camera.updateProjectionMatrix()
    controls.update()
  }, [camera, controls, width, height])

  // Load, resize and explicit requests all refit
  useEffect(fit, [fit, fitRequest])

  return null
}
