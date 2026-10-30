import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TooltipProvider } from './components/ui/tooltip'
import { openSharedLink, watchSharedLinks } from './persistence/open-shared'
import { autosaveSession, restoreSession } from './persistence/session'

// Pick up where the last visit left off, then let a share link (if any) take over — before the first render.
// Autosave starts first so an opened link is already in the session if the page is reloaded.
restoreSession()
autosaveSession()
openSharedLink()
watchSharedLinks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
