import { SuperAnalysisPanel } from "@/components/analyze/super-analysis-panel";

interface SuperAnalysisPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function SuperAnalysisPage({ 
  params 
}: SuperAnalysisPageProps) {
  const { youtubeId } = await params;
  
  return (
    <SuperAnalysisPanel
      key={youtubeId}
      videoId={youtubeId}
      title=""
      channelName=""
    />
  );
}