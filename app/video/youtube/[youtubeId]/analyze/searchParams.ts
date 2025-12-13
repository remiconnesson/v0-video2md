import {
  createLoader,
  createSearchParamsCache,
  parseAsInteger,
} from "nuqs/server";

export const versionSearchParamParsers = {
  version: parseAsInteger
    .withDefault(-1)
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
