import { ENUM_PARAMS, type VaseParams } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'
import { ParamSlider } from './ParamSlider'

type PrintMode = VaseParams['printMode']

const LABELS: Record<PrintMode, string> = {
  vaseMode: 'Vase mode',
  solidWall: 'Solid wall',
}

/** Vase cut in half, seen from the side: one thin line vs. a cup with thick walls. */
const ICONS: Record<PrintMode, string> = {
  vaseMode: 'M9,5V27H23V5',
  solidWall: 'M7,5V28H25V5H21V24H11V5Z',
}

const OPTIONS: IconOption<PrintMode>[] = ENUM_PARAMS.printMode.map((m) => ({
  value: m,
  label: LABELS[m],
  path: ICONS[m],
}))

export function PrintModeControls() {
  const printMode = useVaseStore((s) => s.params.printMode)
  const setParam = useVaseStore((s) => s.setParam)

  return (
    <div className="space-y-4">
      <IconToggleGroup
        value={printMode}
        options={OPTIONS}
        onChange={(v) => setParam('printMode', v)}
        viewBox={{ w: 32, h: 32 }}
        ariaLabel="Print mode"
        variant="stroke"
      />
      {printMode === 'vaseMode' ? (
        <p className="text-xs text-muted-foreground">
          Exports a closed solid. Turn on <span className="font-medium">Spiralize / Vase mode</span> in your
          slicer and it prints as one continuous wall.
        </p>
      ) : (
        <>
          <ParamSlider param="wallThickness" />
          <ParamSlider param="bottomThickness" />
          <p className="text-xs text-muted-foreground">
            Exports a hollow cup. Wall thickness is measured horizontally, the way the slicer fills each layer.
          </p>
        </>
      )}
    </div>
  )
}
