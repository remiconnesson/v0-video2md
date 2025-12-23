import { SuperAnalysisPanel } from "@/components/analyze/super-analysis-panel";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";

interface SuperAnalysisPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function SuperAnalysisPage({
  params,
}: SuperAnalysisPageProps) {
  const { youtubeId } = await params;
  const videoData = await fetchAndSaveTranscript(youtubeId);

  return (
    <SuperAnalysisPanel
      key={youtubeId}
      videoId={youtubeId}
      title={videoData.title}
      channelName={videoData.channelName}
    />
  );
}
