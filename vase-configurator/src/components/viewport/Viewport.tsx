import { Canvas } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
} from '@react-three/drei'
import type { Theme } from '@/hooks/use-theme'
import { BuildVolume } from './BuildVolume'
import { CaptureRegistrar } from './CaptureRegistrar'
import { FitCamera } from './FitCamera'
import { VaseMesh } from './VaseMesh'

// Scene units are millimetres, Y is up, the print bed is the XZ plane at y = 0.
const GRID_COLORS: Record<Theme, { cell: string; section: string }> = {
  dark: { cell: '#2a2a2e', section: '#3d3d44' },
  light: { cell: '#d4d4d8', section: '#a1a1aa' },
}

interface ViewportProps {
  theme: Theme
  showBuildVolume: boolean
  showOverhangs: boolean
}

export function Viewport({ theme, showBuildVolume, showOverhangs }: ViewportProps) {
  const grid = GRID_COLORS[theme]

  return (
    <Canvas
      camera={{ position: [340, 240, 340], fov: 35, near: 1, far: 5000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      className="touch-none"
    >
      {/* Studio lighting built locally (no HDR download) */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[200, 400, 150]} intensity={1.2} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} position={[0, 300, 0]} rotation-x={Math.PI / 2} scale={[400, 400, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-300, 100, 0]} rotation-y={Math.PI / 2} scale={[300, 200, 1]} />
        <Lightformer form="rect" intensity={1} position={[300, 100, 0]} rotation-y={-Math.PI / 2} scale={[300, 200, 1]} />
      </Environment>

      <CaptureRegistrar />
      <VaseMesh showOverhangs={showOverhangs} />
      {showBuildVolume && <BuildVolume theme={theme} />}

      <ContactShadows position={[0, 0.05, 0]} scale={400} blur={2.5} far={200} opacity={theme === 'dark' ? 0.6 : 0.35} />
      <Grid
        infiniteGrid
        cellSize={10}
        sectionSize={50}
        cellColor={grid.cell}
        sectionColor={grid.section}
        fadeDistance={1200}
        fadeStrength={1.5}
      />

      {/* Target and distance are set by FitCamera */}
      <OrbitControls
        makeDefault
        minDistance={60}
        maxDistance={4000}
        maxPolarAngle={Math.PI / 2 - 0.02} // stay above the bed
        enableDamping
      />
      <FitCamera />
    </Canvas>
  )
}
