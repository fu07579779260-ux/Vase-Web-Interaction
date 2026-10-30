import type { VaseParams } from '@/model/params'
import { buildExportFile, type ExportFormat, type ExportStage } from './build-file'
import { loadRhino } from './load-rhino'

/**
 * Export worker: builds files off the main thread, so the page stays
 * responsive while a large .3dm or STL is generated.
 */

export interface ExportRequest {
  id: number
  format: ExportFormat
  params: VaseParams
  name: string
}

export type ExportResponse =
  | { id: number; type: 'stage'; stage: ExportStage }
  | { id: number; type: 'done'; bytes: Uint8Array }
  | { id: number; type: 'error'; message: string }

// The project compiles against DOM types; in a worker `self.postMessage` takes (message, transfer)
type WorkerScope = { postMessage(message: unknown, transfer: Transferable[]): void }
const post = (msg: ExportResponse, transfer: Transferable[] = []) =>
  (self as unknown as WorkerScope).postMessage(msg, transfer)

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  const { id, format, params, name } = e.data
  try {
    const bytes = await buildExportFile(format, params, name, loadRhino, (stage) => post({ id, type: 'stage', stage }))
    // Hand the buffer over instead of copying it
    post({ id, type: 'done', bytes }, [bytes.buffer])
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
