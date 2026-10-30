import { useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { LIP_LABELS } from '@/geometry/lip'
import { PATTERN_LABELS } from '@/geometry/pattern'
import { PRESET_SHAPES } from '@/geometry/profile'
import { SECTION_LABELS } from '@/geometry/section'
import { MATERIALS } from '@/model/materials'
import type { VaseParams } from '@/model/params'
import { PRINTERS } from '@/model/printers'
import { useVaseStore } from '@/store/vase-store'
import { ParamSlider } from './ParamSlider'
import { LipControls } from './LipControls'
import { MaterialControls } from './MaterialControls'
import { PatternControls } from './PatternControls'
import { PrinterControls } from './PrinterControls'
import { PrintModeControls } from './PrintModeControls'
import { ProfileEditor } from './ProfileEditor'
import { ProfilePresetPicker } from './ProfilePresetPicker'
import { QualityControls } from './QualityControls'
import { SectionPicker } from './SectionPicker'
import { TwistControls } from './TwistControls'

interface Section {
  id: string
  title: string
  /** Shown next to the title so a collapsed section still tells you its setting */
  summary: (p: VaseParams) => string
  content: ReactNode
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SECTIONS: Section[] = [
  {
    id: 'shape',
    title: 'Shape',
    summary: (p) => `${p.height} mm`,
    content: (
      <div className="space-y-4">
        <ParamSlider param="height" />
        <ParamSlider param="bottomRadius" />
        <ParamSlider param="topRadius" />
      </div>
    ),
  },
  {
    id: 'profile',
    title: 'Profile',
    summary: (p) => PRESET_SHAPES[p.profilePreset].label,
    content: (
      <div className="space-y-3">
        <ProfilePresetPicker />
        <ProfileEditor />
        <div className="space-y-4 pt-2">
          <ParamSlider param="bellyPosition" />
          <ParamSlider param="bellyWidth" />
          <ParamSlider param="neckPosition" />
          <ParamSlider param="neckWidth" />
        </div>
      </div>
    ),
  },
  {
    id: 'section',
    title: 'Cross-section',
    summary: (p) => (p.sectionShape === 'circle' ? 'Circle' : `${SECTION_LABELS[p.sectionShape]} · ${p.sides}`),
    content: <SectionPicker />,
  },
  { id: 'twist', title: 'Twist', summary: (p) => `${p.twist}°`, content: <TwistControls /> },
  { id: 'pattern', title: 'Surface pattern', summary: (p) => PATTERN_LABELS[p.patternType], content: <PatternControls /> },
  { id: 'lip', title: 'Lip', summary: (p) => LIP_LABELS[p.lipType], content: <LipControls /> },
  {
    id: 'mode',
    title: 'Print mode',
    summary: (p) => (p.printMode === 'vaseMode' ? 'Vase mode' : `Solid ${p.wallThickness} mm`),
    content: <PrintModeControls />,
  },
  { id: 'printer', title: 'Printer', summary: (p) => PRINTERS[p.printerPreset].label, content: <PrinterControls /> },
  { id: 'material', title: 'Material', summary: (p) => MATERIALS[p.material].label, content: <MaterialControls /> },
  { id: 'quality', title: 'Export quality', summary: (p) => capitalise(p.qualityPreset), content: <QualityControls /> },
]

// Which sections are open is a per-browser convenience, so plain localStorage is fine
const OPEN_KEY = 'vase-configurator:panel-open'
const DEFAULT_OPEN = ['shape', 'profile']

function readOpen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : DEFAULT_OPEN
  } catch {
    return DEFAULT_OPEN
  }
}

/** @param showTitle false inside the phone bottom sheet, whose handle already says "Parameters" */
export function ParamPanel({ showTitle = true }: { showTitle?: boolean }) {
  const reset = useVaseStore((s) => s.reset)
  const params = useVaseStore((s) => s.params)
  const [open, setOpen] = useState<string[]>(readOpen)

  function onOpenChange(next: string[]) {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      // Not remembered this time; nothing else depends on it
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        {showTitle ? (
          <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Parameters</h2>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw />
          Reset
        </Button>
      </div>

      <Accordion type="multiple" value={open} onValueChange={onOpenChange}>
        {SECTIONS.map((s) => (
          <AccordionItem key={s.id} value={s.id}>
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex flex-1 items-baseline justify-between gap-3 pr-2">
                <span className="font-medium">{s.title}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{s.summary(params)}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5">{s.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
