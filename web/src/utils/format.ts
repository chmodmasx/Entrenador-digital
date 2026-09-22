export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  const value = Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1).replace('.', ',');
  return `${value} s`;
}

export function formatMilliseconds(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2).replace('.', ',')} s`;
}

export function formatWait(minimumMs: number, maximumMs: number): string {
  if (Math.abs(maximumMs - minimumMs) < 1) return formatSeconds(minimumMs);
  return `${formatSeconds(minimumMs)} – ${formatSeconds(maximumMs)}`;
}
