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
 * Query configuration for slides panel tabs.
 * This configuration defines the query parameters used for tab navigation
 * within the slides panel component.
 */
export const slidesPanelTabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};
