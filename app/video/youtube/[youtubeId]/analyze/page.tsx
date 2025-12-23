import { redirect } from "next/navigation";
import { LEGACY_TAB_MAPPING } from "./_components/analyze-route-map";

interface AnalyzePageProps {
  params: Promise<{ youtubeId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyzePage({ 
  params, 
  searchParams 
}: AnalyzePageProps) {
  const { youtubeId } = await params;
  const search = await searchParams;
  
  // Handle legacy tab query parameters
  const legacyTab = search.tab as string;
  if (legacyTab && LEGACY_TAB_MAPPING[legacyTab]) {
    redirect(`/video/youtube/${youtubeId}/analyze/${LEGACY_TAB_MAPPING[legacyTab]}`);
  }
  
  // Default redirect to transcript analysis
  redirect(`/video/youtube/${youtubeId}/analyze/transcript-analysis`);
}
