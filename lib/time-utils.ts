export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Helper function to format duration from seconds to human-readable format
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

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
