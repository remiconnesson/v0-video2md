import { z } from "zod";

const versionSchema = z.number().int().positive();

export function parseVersion(version: unknown): number {
  return versionSchema.parse(version);
}

export function parseVersions(versions: unknown): number[] {
  return versionSchema.array().parse(versions);
}

export function getSortedVersionsDescending(versions: number[]): number[] {
  return versions.sort((a, b) => b - a);
}
