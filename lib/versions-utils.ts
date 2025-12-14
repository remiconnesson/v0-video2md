import { Brand } from "effect";
import { z } from "zod";

export type Versions = number[] & Brand.Brand<"Versions">;
const Versions = Brand.nominal<Versions>();

const versionSchema = z.coerce.number().int().positive();

export function parseVersion(version: unknown): number {
  return versionSchema.parse(version);
}

export function parseVersions(versions: unknown): Versions {
  // we are branding so that we can track the guarantee that the versions are sorted descending
  return Versions(
    getSortedVersionsDescending(versionSchema.array().parse(versions)),
  );
}

export function getSortedVersionsDescending(versions: number[]): number[] {
  return [...versions].sort((a, b) => b - a);
}

export function getLikelyNextVersion(versions: Versions): number {
  // it's likely because in the event that the user has twice the same video open in different tabs, and has already launched a new analysis, then the next version will not be accurate
  // but we don't care about this for now
  if (versions.length === 0) {
    return 1;
  } else {
    return versions[0] + 1;
  }
}

export function getVersion(
  version: number,
  versions: Versions,
  sentinel: number,
): number {
  if (version === sentinel) {
    return versions[0] ?? 1;
  }

  return version;
}
