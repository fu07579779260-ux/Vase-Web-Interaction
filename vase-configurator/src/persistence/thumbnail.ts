/**
 * Thumbnails for saved designs, grabbed from the 3D view.
 *
 * The viewport registers a capture function (it owns the WebGL renderer).
 * Capturing renders one fresh frame and copies it in the same task, so the
 * canvas needs no preserveDrawingBuffer (which would slow every frame).
 */

const SIZE = 192
const QUALITY = 0.8

let captureFrame: (() => HTMLCanvasElement) | null = null

export function registerCapture(fn: (() => HTMLCanvasElement) | null) {
  captureFrame = fn
}

/** Centre-cropped square JPEG data URL, or '' if the view isn't available. */
export function captureThumbnail(): string {
  try {
    const source = captureFrame?.()
    if (!source || source.width === 0 || source.height === 0) return ''
    const out = document.createElement('canvas')
    out.width = SIZE
    out.height = SIZE
    const ctx = out.getContext('2d')
    if (!ctx) return ''
    // The WebGL canvas is transparent; JPEG needs the page background behind it
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#111'
    ctx.fillRect(0, 0, SIZE, SIZE)
    const side = Math.min(source.width, source.height)
    ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
    return out.toDataURL('image/jpeg', QUALITY)
  } catch {
    return ''
  }
}
