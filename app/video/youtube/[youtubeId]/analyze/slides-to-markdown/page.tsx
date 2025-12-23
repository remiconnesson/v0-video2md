import { SlideAnalysisPanel } from "@/components/analyze/slide-analysis-panel";

interface SlidesToMarkdownPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function SlidesToMarkdownPage({
  params,
}: SlidesToMarkdownPageProps) {
  const { youtubeId } = await params;

  return <SlideAnalysisPanel videoId={youtubeId} />;
}
