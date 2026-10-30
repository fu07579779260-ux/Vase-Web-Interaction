import type { RhinoModule } from 'rhino3dm'
import type { VaseParams } from '@/model/params'
import { constructionCurves } from './curves'
import { buildExportMesh } from './export'
import { write3dm } from './rhino'
import { meshToStl } from './stl'
import { vaseSurfaces } from './surface'

/**
 * Build an export file's bytes. No DOM access, so it runs both in the export
 * worker and, as a fallback, on the main thread.
 */

export type ExportFormat = 'stl' | '3dm'
export type ExportStage = 'loading-rhino' | 'generating'

export async function buildExportFile(
  format: ExportFormat,
  params: VaseParams,
  name: string,
  loadRhino: () => Promise<RhinoModule>,
  onStage: (stage: ExportStage) => void = () => {},
): Promise<Uint8Array> {
  if (format === 'stl') {
    onStage('generating')
    return new Uint8Array(meshToStl(buildExportMesh(params)))
  }
  onStage('loading-rhino')
  const rhino = await loadRhino()
  onStage('generating')
  return write3dm(rhino, {
    mesh: buildExportMesh(params),
    surfaces: vaseSurfaces(params),
    curves: constructionCurves(params),
    name,
  })
}
