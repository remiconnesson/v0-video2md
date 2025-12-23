import { redirect } from "next/navigation";

interface AnalyzePageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function AnalyzePage({
  params,
}: AnalyzePageProps) {
  const { youtubeId } = await params;

  // Default redirect to transcript analysis
  redirect(`/video/youtube/${youtubeId}/analyze/transcript-analysis`);
}
