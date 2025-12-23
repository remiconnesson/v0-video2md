import { SlidesPanel } from "@/components/analyze/slides-panel";

interface SlidesSelectionPageProps {
  params: Promise<{ youtubeId: string }>;
}

export default async function SlidesSelectionPage({ 
  params 
}: SlidesSelectionPageProps) {
  const { youtubeId } = await params;
  
  return <SlidesPanel videoId={youtubeId} />;
}