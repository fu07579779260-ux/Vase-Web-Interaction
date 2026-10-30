import type { VaseParams } from '@/model/params'
import { buildExportFile, type ExportFormat, type ExportStage } from './build-file'
import type { ExportRequest, ExportResponse } from './export.worker'
import { loadRhino } from './load-rhino'

/**
 * Run an export in the worker. If the browser can't start the worker, fall
 * back to the main thread (slower to respond, same result).
 */

let worker: Worker | null | undefined
let nextId = 1
const pending = new Map<
  number,
  { resolve: (b: Uint8Array) => void; reject: (e: Error) => void; onStage: (s: ExportStage) => void }
>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ExportResponse>) => {
      const msg = e.data
      const job = pending.get(msg.id)
      if (!job) return
      if (msg.type === 'stage') return job.onStage(msg.stage)
      pending.delete(msg.id)
      if (msg.type === 'done') job.resolve(msg.bytes)
      else job.reject(new Error(msg.message))
    }
    worker.onerror = (e) => {
      // A crashed worker fails every job in flight; the next export starts a fresh one
      for (const job of pending.values()) job.reject(new Error(e.message || 'Export worker failed'))
      pending.clear()
      worker?.terminate()
      worker = undefined
    }
  } catch {
    worker = null // workers unavailable: use the main thread from now on
  }
  return worker
}

export function exportFile(
  format: ExportFormat,
  params: VaseParams,
  name: string,
  onStage: (stage: ExportStage) => void = () => {},
): Promise<Uint8Array> {
  const w = getWorker()
  if (!w) return buildExportFile(format, params, name, loadRhino, onStage)
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onStage })
    const request: ExportRequest = { id, format, params, name }
    w.postMessage(request)
  })
}
