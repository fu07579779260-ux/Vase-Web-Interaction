import { EXPORT_DETAIL } from '@/geometry/pattern'
import { exportResolution, generateVaseMesh, type MeshData } from '@/geometry/vase-mesh'
import type { VaseParams } from '@/model/params'

/** Full-quality mesh for export (the preview uses a lighter one). */
export function buildExportMesh(params: VaseParams): MeshData {
  return generateVaseMesh(params, exportResolution(params), EXPORT_DETAIL)
}

/** Safe file name: letters, digits, dash, underscore, dot and space; never empty. */
export function sanitizeFileName(name: string, fallback = 'vase'): string {
  const clean = name
    .trim()
    .replace(/\.(stl|3dm)$/i, '')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
  return clean || fallback
}

/** Hand a file to the browser as a download. */
export function downloadFile(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the blob
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
