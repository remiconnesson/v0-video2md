/**
 * Environment configuration module.
 * Ported from Python: src/slides_extractor/settings.py
 */

import { z } from "zod";

// Schema for environment validation
const envSchema = z.object({
  // Optional proxy configuration
  ZYTE_API_KEY: z.string().optional(),
  ZYTE_HOST: z.string().default("api.zyte.com"),

  // API authentication
  API_PASSWORD: z.string().default(""),

  // Vercel Blob configuration
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Image quality settings
  SLIDE_IMAGE_QUALITY: z.number().default(80),
});

// Parse and validate environment
function getConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

// Export validated config (lazy evaluation)
let _config: z.infer<typeof envSchema> | null = null;

export function config() {
  if (!_config) {
    _config = getConfig();
  }
  return _config;
}

export const getZyteApiKey = () => config().ZYTE_API_KEY;
export const getZyteHost = () => config().ZYTE_HOST;

// API authentication
export const getApiPassword = () => config().API_PASSWORD;

// Vercel Blob configuration
export const getBlobReadWriteToken = () => config().BLOB_READ_WRITE_TOKEN;

// Image quality settings
export const getSlideImageQuality = () => config().SLIDE_IMAGE_QUALITY;

// Constants (matching Python settings.py)
export const VIDEO_DOWNLOAD_THREADS = 32;
export const AUDIO_DOWNLOAD_THREADS = 8;
export const MIN_SIZE_FOR_PARALLEL_DOWNLOAD = 1 * 1024 * 1024; // 1MB
export const PARALLEL_CHUNK_SIZE = 1024 * 1024; // 1MB
export const SINGLE_THREAD_CHUNK_SIZE = 32 * 1024; // 32KB
export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

// Temp directory for Vercel
export const TEMP_DIR = "/tmp";
