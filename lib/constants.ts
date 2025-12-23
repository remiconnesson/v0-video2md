export const UI = {
  // Copy feedback timings for clipboard interactions.
  COPY_FEEDBACK_DURATION_MS: 2000,
  // Virtualized slide list tuning.
  VIRTUAL_LIST_OVERSCAN: 2,
  SLIDE_CARD_ESTIMATED_HEIGHT: 500,
  // Slides panel scroll container heights.
  SLIDES_PANEL_HEIGHT: { mobile: 400, desktop: 600 },
  // Slides panel viewport offset for dynamic height calculation (100vh - offset).
  SLIDES_PANEL_VIEWPORT_OFFSET_PX: 200,
} as const;
