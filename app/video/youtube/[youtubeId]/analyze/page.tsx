import { AnalyzeShell } from "@/components/analyze/analyze-shell";
import { getCompletedAnalysis, hasSlideAnalysisResults } from "@/db/queries";
import { ensureVideoProcessed } from "@/lib/fetch-and-save-transcript";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";

type AnalyzePageProps = {
  params: Promise<{ youtubeId: string }>;
};

export default async function AnalyzePage(props: AnalyzePageProps) {
  const { youtubeId } = await props.params;
  console.log("[AnalyzePage] 1. Start, videoId:", youtubeId);

  if (!isValidYouTubeVideoId(youtubeId)) {
    console.log("[AnalyzePage] 2. Invalid videoId");
    return <ErrorScreen errorMessage="Invalid YouTube Video ID" />;
  }

  console.log("[AnalyzePage] 3. Fetching transcript data...");
  // Optimized fetch that only gets metadata if transcript exists
  const videoData = await ensureVideoProcessed(youtubeId);
  console.log("[AnalyzePage] 4. Got transcript data:", videoData.title);

  const [completedAnalysis, hasSlideAnalysis] = await Promise.all([
    getCompletedAnalysis(youtubeId),
    hasSlideAnalysisResults(youtubeId),
  ]);
  const hasTranscriptAnalysis = !!completedAnalysis?.result;

  return (
    <AnalyzeShell
      videoId={youtubeId}
      title={videoData.title}
      channelName={videoData.channelName}
      hasTranscriptAnalysis={hasTranscriptAnalysis}
      hasSlideAnalysis={hasSlideAnalysis}
    />
  );
}

function ErrorScreen({ errorMessage }: { errorMessage: string }) {
  return <div>Error: {errorMessage}</div>;
}
