function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

export const CONFIG = {
  SLIDES_EXTRACTOR_URL: getEnv("SLIDES_EXTRACTOR_URL"),
  SLIDES_API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN"),
};
