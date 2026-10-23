/** A row of toggle buttons, one of them pressed. */
export function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  value: T
}) {
  return (
    <div aria-label={label} className="segmented" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
