import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { registerCapture } from '@/persistence/thumbnail'

/** Lets the save flow grab a frame from this canvas. */
export function CaptureRegistrar() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    registerCapture(() => {
      gl.render(scene, camera)
      return gl.domElement
    })
    return () => registerCapture(null)
  }, [gl, scene, camera])

  return null
}
