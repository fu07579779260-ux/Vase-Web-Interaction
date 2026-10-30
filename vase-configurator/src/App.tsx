import { useEffect, useState } from 'react'
import { Box, Focus, Moon, Sun, TriangleAlert } from 'lucide-react'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ExportDialog } from '@/components/export/ExportDialog'
import { DesignBar } from '@/components/gallery/DesignBar'
import { NoticeBanner } from '@/components/NoticeBanner'
import { ParamPanel } from '@/components/panel/ParamPanel'
import { Viewport } from '@/components/viewport/Viewport'
import { WarningsStrip } from '@/components/viewport/WarningsStrip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTheme } from '@/hooks/use-theme'
import { useViewStore } from '@/store/view-store'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [showBuildVolume, setShowBuildVolume] = useState(true)
  const [showOverhangs, setShowOverhangs] = useState(true)
  const wide = useMediaQuery('(min-width: 768px)')
  const requestFit = useViewStore((s) => s.requestFit)

  // F frames the vase, unless you're typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey) return
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      requestFit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestFit])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b px-2 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="hidden text-sm font-semibold tracking-wide lg:block">Vase Configurator</h1>
          <DesignBar />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ExportDialog />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>
      <NoticeBanner />

      {/* Viewport + parameter panel: side panel from tablet width up, bottom sheet on phones */}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="relative min-h-0 flex-1 bg-muted/30">
          <div className="absolute inset-0">
            <Viewport theme={theme} showBuildVolume={showBuildVolume} showOverhangs={showOverhangs} />
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            <Toggle
              variant="outline"
              size="sm"
              pressed={showBuildVolume}
              onPressedChange={setShowBuildVolume}
              className="bg-background/70 backdrop-blur"
              aria-label="Show printer build volume"
            >
              <Box />
              <span className="hidden sm:inline">Build volume</span>
            </Toggle>
            <Toggle
              variant="outline"
              size="sm"
              pressed={showOverhangs}
              onPressedChange={setShowOverhangs}
              className="bg-background/70 backdrop-blur"
              aria-label="Highlight overhangs in red"
            >
              <TriangleAlert />
              <span className="hidden sm:inline">Overhangs</span>
            </Toggle>
            <Button
              variant="outline"
              size="sm"
              onClick={requestFit}
              className="bg-background/70 backdrop-blur"
              title="Frame the whole vase (F)"
              aria-label="Fit vase in view"
            >
              <Focus />
              <span className="hidden sm:inline">Fit</span>
            </Button>
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex">
            <div className="pointer-events-auto">
              <WarningsStrip />
            </div>
          </div>
        </section>

        {wide ? (
          <aside className="w-80 overflow-y-auto border-l p-4 lg:w-96">
            <ParamPanel />
          </aside>
        ) : (
          <BottomSheet title="Parameters">
            <ParamPanel showTitle={false} />
          </BottomSheet>
        )}
      </main>
    </div>
  )
}

export default App
