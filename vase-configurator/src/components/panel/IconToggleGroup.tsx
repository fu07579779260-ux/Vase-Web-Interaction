import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export interface IconOption<T extends string> {
  value: T
  label: string
  /** SVG path drawn in a `viewBox` of the given size */
  path: string
}

interface Props<T extends string> {
  value: T
  options: IconOption<T>[]
  onChange: (value: T) => void
  viewBox: { w: number; h: number }
  ariaLabel: string
  /** Filled silhouettes (default) or line drawings such as curves */
  variant?: 'fill' | 'stroke'
}

/** A row of single-select buttons, each with a small silhouette icon and a label. */
export function IconToggleGroup<T extends string>({
  value,
  options,
  onChange,
  viewBox,
  ariaLabel,
  variant = 'fill',
}: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Clicking the active item would deselect it; re-select instead
      onValueChange={(v) => onChange((v || value) as T)}
      className="grid w-full gap-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          aria-label={o.label}
          title={o.label}
          className="flex h-auto flex-col gap-1 rounded-md! border px-1 py-2 data-[state=on]:border-primary"
        >
          <svg viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} className="h-8 w-8" aria-hidden>
            {variant === 'fill' ? (
              <path d={o.path} className="fill-current opacity-80" />
            ) : (
              <path
                d={o.path}
                className="fill-none stroke-current opacity-80"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          <span className="text-[10px] leading-none">{o.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
