import { useId, useRef, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { shareUrl } from '@/persistence/share-link'
import { useDesignStore } from '@/store/design-store'
import { useVaseStore } from '@/store/vase-store'

export function ShareDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Share a link to this design">
          <Link2 />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {/* Separate component: only mounted (and the link only built) while the dialog is open */}
        <ShareContent />
      </DialogContent>
    </Dialog>
  )
}

function ShareContent() {
  const linkId = useId()
  const params = useVaseStore((s) => s.params)
  const name = useDesignStore((s) => s.name)
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle')
  const input = useRef<HTMLInputElement>(null)

  const url = shareUrl(name, params)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('done')
    } catch {
      // Clipboard blocked (permissions, insecure context): select it for Ctrl+C instead
      input.current?.select()
      setCopied('manual')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share link</DialogTitle>
        <DialogDescription>
          The whole design is inside the link — nothing is uploaded. Anyone who opens it gets a copy they can change
          without affecting yours.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={linkId}>Link to “{name}”</Label>
        <div className="flex gap-2">
          <Input
            id={linkId}
            ref={input}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button onClick={copy}>
            {copied === 'done' ? <Check /> : <Copy />}
            {copied === 'done' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {copied === 'manual'
            ? 'Your browser blocked copying — the link is selected, press Ctrl+C.'
            : `${url.length} characters`}
        </p>
      </div>
    </>
  )
}
