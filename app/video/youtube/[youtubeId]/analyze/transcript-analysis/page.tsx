import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";

interface TranscriptAnalysisPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function TranscriptAnalysisPage({
  params,
}: TranscriptAnalysisPageProps) {
  const { youtubeId } = await params;
  const videoData = await fetchAndSaveTranscript(youtubeId);

  return (
    <AnalysisPanel
      videoId={youtubeId}
      title={videoData.title}
      channelName={videoData.channelName}
    />
  );
}
