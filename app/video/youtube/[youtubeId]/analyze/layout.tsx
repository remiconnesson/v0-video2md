import { Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCompletedAnalysis, hasSlideAnalysisResults } from "@/db/queries";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { AnalyzeNav } from "./_components/analyze-nav";

interface AnalyzeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ youtubeId: string }>;
}

export default async function AnalyzeLayout({
  children,
  params,
}: AnalyzeLayoutProps) {
  const { youtubeId } = await params;

  if (!isValidYouTubeVideoId(youtubeId)) {
    return <ErrorScreen errorMessage="Invalid YouTube Video ID" />;
  }

  // Fetch shared data once for all child routes
  const videoData = await fetchAndSaveTranscript(youtubeId);
  const [completedAnalysis, hasSlideAnalysis] = await Promise.all([
    getCompletedAnalysis(youtubeId),
    hasSlideAnalysisResults(youtubeId),
  ]);

  const hasTranscriptAnalysis = !!completedAnalysis?.result;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="shrink-0">
                <Link href="/">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
              <div className="min-w-0 hidden md:block">
                <h1 className="text-lg md:text-xl font-bold truncate">
                  {videoData.title}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  {videoData.channelName}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-4 px-4 pb-1 md:pb-0 md:mx-0 md:px-0 scrollbar-hide">
              <AnalyzeNav
                videoId={youtubeId}
                hasTranscriptAnalysis={hasTranscriptAnalysis}
                hasSlideAnalysis={hasSlideAnalysis}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

function ErrorScreen({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p>{errorMessage}</p>
      </div>
    </div>
  );
}
