import {
  createLoader,
  createSearchParamsCache,
  parseAsInteger,
} from "nuqs/server";

export const VERSION_NOT_PROVIDED_SENTINEL = -1;

export const versionSearchParamParsers = {
  version: parseAsInteger
    .withDefault(VERSION_NOT_PROVIDED_SENTINEL)
    .withOptions({ shallow: false, clearOnDefault: false }),
};

export const loadVersionSearchParams = createLoader(versionSearchParamParsers);

export const VERSION_SEARCH_PARAM_KEY = "v";

export const urlKeys = {
  version: VERSION_SEARCH_PARAM_KEY,
} as const;

export const versionSearchParamsCache = createSearchParamsCache(
  versionSearchParamParsers,
  {
    urlKeys,
  },
);
