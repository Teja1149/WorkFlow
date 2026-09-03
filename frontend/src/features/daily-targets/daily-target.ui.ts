export function formatTargetValue(
  value: number | string,
  unit: string,
) {
  return `${Number(value || 0)} ${unit || 'units'}`
}

export function targetAchievement(
  target: number | string,
  actual: number | string,
) {
  const targetValue = Number(target || 0)
  const actualValue = Number(actual || 0)

  if (targetValue <= 0) return 0

  return Math.min(
    100,
    Math.round(
      (actualValue / targetValue) * 100,
    ),
  )
}

export function targetRemaining(
  target: number | string,
  actual: number | string,
) {
  return Math.max(
    0,
    Number(target || 0) -
      Number(actual || 0),
  )
}

export function resultReasonLabel(
  reason?: string | null,
) {
  if (!reason) return 'Not specified'

  return reason
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    )
}
