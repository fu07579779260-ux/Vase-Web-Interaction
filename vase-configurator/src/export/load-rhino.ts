import type { RhinoModule } from 'rhino3dm'

let loading: Promise<RhinoModule> | null = null

/**
 * Load rhino3dm (≈2.7 MB of WASM) on first use only, so it never slows down
 * opening the app. Uses the package's ES-module build and lets Vite serve the
 * .wasm file. A failed load can be retried.
 */
export function loadRhino(): Promise<RhinoModule> {
  loading ??= (async () => {
    const [{ default: rhino3dm }, { default: wasmUrl }] = await Promise.all([
      import('rhino3dm/rhino3dm.module.js'),
      import('rhino3dm/rhino3dm.wasm?url'),
    ])
    return rhino3dm({ locateFile: () => wasmUrl })
  })().catch((error) => {
    loading = null
    throw error
  })
  return loading
}
