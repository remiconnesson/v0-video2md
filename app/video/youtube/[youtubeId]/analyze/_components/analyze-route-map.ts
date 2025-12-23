import {
  FileText,
  FolderOpen,
  type LucideIcon,
  Sparkles,
  Wand2,
} from "lucide-react";

export type AnalyzeRouteId =
  | "transcript-analysis"
  | "slides-selection"
  | "slides-to-markdown"
  | "super-analysis";

export interface AnalyzeRoute {
  id: AnalyzeRouteId;
  label: string;
  icon: LucideIcon;
  description: string;
  requiresSlides?: boolean;
  requiresTranscript?: boolean;
}

export const ANALYZE_ROUTES: AnalyzeRoute[] = [
  {
    id: "transcript-analysis",
    label: "Transcript Analysis",
    icon: FileText,
    description: "AI-powered analysis of video transcript",
  },
  {
    id: "slides-selection",
    label: "Slides Selection",
    icon: FolderOpen,
    description: "Extract and select presentation slides",
  },
  {
    id: "slides-to-markdown",
    label: "Slides to Markdown",
    icon: Sparkles,
    description: "Convert slides to structured markdown",
    requiresSlides: true,
  },
  {
    id: "super-analysis",
    label: "Super Analysis",
    icon: Wand2,
    description: "Unified analysis combining transcript and slides",
    requiresSlides: true,
    requiresTranscript: true,
  },
];

export function getRouteById(id: AnalyzeRouteId): AnalyzeRoute {
  return ANALYZE_ROUTES.find((route) => route.id === id)!;
}

export function isRouteAvailable(
  route: AnalyzeRoute,
  hasTranscript: boolean,
  hasSlides: boolean,
): boolean {
  if (route.requiresTranscript && !hasTranscript) return false;
  if (route.requiresSlides && !hasSlides) return false;
  return true;
}
