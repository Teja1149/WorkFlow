export default function ProgressBar({
  value,
  showLabel = true,
}: {
  value: number
  showLabel?: boolean
}) {
  const safeValue = Math.min(
    100,
    Math.max(0, Number(value) || 0),
  )

  return (
    <div>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-slate-500">
            Progress
          </span>

          <span className="font-semibold text-slate-700">
            {safeValue}%
          </span>
        </div>
      )}

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#801424] transition-all"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  )
}
