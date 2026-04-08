export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hourMatch = trimmed.match(/^(-?\d+\.?\d*)h$/i);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    if (hours < 0) return null;
    return Math.round(hours * 60);
  }

  const minMatch = trimmed.match(/^(-?\d+)m$/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    if (mins < 0) return null;
    return mins;
  }

  const numMatch = trimmed.match(/^(-?\d+\.?\d*)$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (val < 0) return null;
    return Math.round(val);
  }

  return null;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes === 0) return '';

  if (minutes < 60) return `${minutes}m`;

  const hours = minutes / 60;
  if (hours === Math.floor(hours)) return `${hours}h`;
  return `${parseFloat(hours.toFixed(1))}h`;
}
