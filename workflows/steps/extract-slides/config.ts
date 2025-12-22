function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

// Lazy config that defers environment variable access until runtime
export const CONFIG = {
  get SLIDES_EXTRACTOR_URL() {
    return getEnv("SLIDES_EXTRACTOR_URL");
  },
  get SLIDES_API_PASSWORD() {
    return getEnv("SLIDES_API_PASSWORD");
  },
  get BLOB_READ_WRITE_TOKEN() {
    return getEnv("BLOB_READ_WRITE_TOKEN");
  },
};
