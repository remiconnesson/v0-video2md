import { createParser } from "nuqs";

/**
 * Parser for boolean presence in query parameters.
 * - Empty string or "true" (case-insensitive) → true
 * - Otherwise → null
 */
export const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

/**
 * Query configuration for analyze shell tabs.
 * Note: Intentionally separate from slidesPanelTabQueryConfig for semantic clarity,
 * even though they currently have the same shape. This allows independent evolution.
 */
export const analyzeShellTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};

/**
 * Query configuration for analyze tabs (used in tab navigation components)
 */
export const analyzeTabsTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  superAnalysis: parseAsPresence,
};

/**
 * Query configuration for slides panel tabs.
 * Note: Intentionally separate from analyzeShellTabQueryConfig for semantic clarity,
 * even though they currently have the same shape. This allows independent evolution.
 */
export const slidesPanelTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};
