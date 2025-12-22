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
 * Query configuration for analyze tabs in analyze-shell.tsx
 */
export const analyzeShellTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};

/**
 * Query configuration for analyze tabs in analyze-tabs.tsx
 */
export const analyzeTabsTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  superAnalysis: parseAsPresence,
};

/**
 * Query configuration for slides panel tabs
 */
export const slidesPanelTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};
