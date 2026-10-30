import { analyzeVase, type Analysis } from '@/geometry/checks'
import { EXPORT_DETAIL, PREVIEW_DETAIL } from '@/geometry/pattern'
import { generateVaseMesh, previewResolution, type MeshData } from '@/geometry/vase-mesh'
import type { VaseParams } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'

export interface Preview {
  mesh: MeshData
  analysis: Analysis
}

// The store replaces the params object on every change, so its identity is a
// perfect cache key: the viewport and the warnings strip share one mesh.
const cache = new WeakMap<VaseParams, Preview>()

export function buildPreview(params: VaseParams): Preview {
  let hit = cache.get(params)
  if (!hit) {
    const detail = params.previewAtExportQuality ? EXPORT_DETAIL : PREVIEW_DETAIL
    const mesh = generateVaseMesh(params, previewResolution(params), detail)
    hit = { mesh, analysis: analyzeVase(params, mesh) }
    cache.set(params, hit)
  }
  return hit
}

/** Preview mesh and its printability analysis for the current parameters. */
export function usePreview(): Preview {
  return buildPreview(useVaseStore((s) => s.params))
}
