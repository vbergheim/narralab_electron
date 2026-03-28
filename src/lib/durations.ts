export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

export function minutesToSeconds(minutes: number) {
  return Math.round(minutes * 60)
}

export function secondsToMinutes(seconds: number) {
  return Number((seconds / 60).toFixed(1))
}
