import { describe, it, expect } from "vitest";
import {
  LEGACY_TAB_MAPPING,
  isRouteAvailable,
  ANALYZE_ROUTES,
  getRouteById,
} from "../app/video/youtube/[youtubeId]/analyze/_components/analyze-route-map";

describe("Legacy Tab Mapping", () => {
  it("maps legacy analyze to transcript-analysis", () => {
    expect(LEGACY_TAB_MAPPING.analyze).toBe("transcript-analysis");
  });

  it("maps legacy slides to slides-selection", () => {
    expect(LEGACY_TAB_MAPPING.slides).toBe("slides-selection");
  });

  it("maps legacy slideAnalysis to slides-to-markdown", () => {
    expect(LEGACY_TAB_MAPPING.slideAnalysis).toBe("slides-to-markdown");
  });

  it("maps legacy slidesAnalysis to slides-to-markdown", () => {
    expect(LEGACY_TAB_MAPPING.slidesAnalysis).toBe("slides-to-markdown");
  });

  it("maps legacy superAnalysis to super-analysis", () => {
    expect(LEGACY_TAB_MAPPING.superAnalysis).toBe("super-analysis");
  });
});

describe("Route Availability", () => {
  it("allows transcript-analysis without any data", () => {
    const route = getRouteById("transcript-analysis");
    expect(isRouteAvailable(route, false, false)).toBe(true);
  });

  it("allows slides-selection without any data", () => {
    const route = getRouteById("slides-selection");
    expect(isRouteAvailable(route, false, false)).toBe(true);
  });

  it("requires slides for slides-to-markdown", () => {
    const route = getRouteById("slides-to-markdown");
    expect(isRouteAvailable(route, true, false)).toBe(false);
    expect(isRouteAvailable(route, true, true)).toBe(true);
  });

  it("requires both transcript and slides for super-analysis", () => {
    const route = getRouteById("super-analysis");
    expect(isRouteAvailable(route, false, false)).toBe(false);
    expect(isRouteAvailable(route, true, false)).toBe(false);
    expect(isRouteAvailable(route, false, true)).toBe(false);
    expect(isRouteAvailable(route, true, true)).toBe(true);
  });
});

describe("Route Configuration", () => {
  it("has all required routes", () => {
    const routeIds = ANALYZE_ROUTES.map((r) => r.id);
    expect(routeIds).toContain("transcript-analysis");
    expect(routeIds).toContain("slides-selection");
    expect(routeIds).toContain("slides-to-markdown");
    expect(routeIds).toContain("super-analysis");
  });

  it("each route has required properties", () => {
    ANALYZE_ROUTES.forEach((route) => {
      expect(route).toHaveProperty("id");
      expect(route).toHaveProperty("label");
      expect(route).toHaveProperty("icon");
      expect(route).toHaveProperty("description");
    });
  });
});
