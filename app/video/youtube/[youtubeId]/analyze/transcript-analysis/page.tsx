import { AnalysisPanel } from "@/components/analyze/analysis-panel";

interface TranscriptAnalysisPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function TranscriptAnalysisPage({
  params,
}: TranscriptAnalysisPageProps) {
  const { youtubeId } = await params;

  return <AnalysisPanel videoId={youtubeId} />;
}
