export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}

export function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  const parts = hours > 0 ? [hours, minutes, remainingSeconds] : [minutes, remainingSeconds];

  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatMonth(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

export function weekdayShort(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short"
  }).format(new Date(value));
}
