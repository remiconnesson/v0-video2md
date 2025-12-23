export function toClockParts(seconds: number): ClockParts {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return { hours, mins, secs };
}

export type ClockParts = {
  hours: number;
  mins: number;
  secs: number;
};

export function formatClockParts({ hours, mins, secs }: ClockParts): string {
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";
  const { hours, mins, secs } = toClockParts(seconds);
  return formatClockParts({ hours, mins, secs });
}

/**
 * Parses a duration string into total seconds.
 *
 * Supported formats:
 * - "MM:SS" (e.g., "10:30") -> Returns minutes * 60 + seconds.
 *   Note: In this format, minutes must be <= 255.
 * - "HH:MM:SS" (e.g., "1:00:00") -> Returns hours * 3600 + minutes * 60 + seconds.
 *
 * @param value - The duration string to parse (optional).
 * @returns The total number of seconds, or `null` if the input is invalid, undefined, empty, or if minutes > 255 in "MM:SS" format.
 */
export function parseDuration(value?: string): number | null {
  if (!value) return null;

  const timeParts = value.trim().split(":");
  if (timeParts.length !== 2 && timeParts.length !== 3) return null;

  const normalizedParts = timeParts.map((part) => {
    const numericValue = Number(part);
    if (!Number.isFinite(numericValue) || numericValue < 0) return null;

    const flooredValue = Math.floor(numericValue);
    return Number.isInteger(flooredValue) ? flooredValue : null;
  });

  if (normalizedParts.some((part) => part === null)) return null;

  const [hoursOrMinutes, minutesOrSeconds, seconds] =
    normalizedParts as number[];

  // For MM:SS format, validate that minutes <= 255
  if (timeParts.length === 2 && hoursOrMinutes > 255) return null;

  if (timeParts.length === 2) {
    return hoursOrMinutes * 60 + minutesOrSeconds;
  }

  return hoursOrMinutes * 3600 + minutesOrSeconds * 60 + seconds;
}
