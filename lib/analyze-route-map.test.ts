import { describe, it, expect } from "vitest";
import { 
  isRouteAvailable, 
  ANALYZE_ROUTES,
  getRouteById 
} from "../app/video/youtube/[youtubeId]/analyze/_components/analyze-route-map";

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
