import { Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCompletedAnalysis, hasSlideAnalysisResults } from "@/db/queries";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { AnalyzeLayoutSidebar } from "./_components/analyze-layout-sidebar";
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
      {/* Mobile header - visible only on mobile/tablet */}
      <header className="lg:hidden sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">{videoData.title}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {videoData.channelName}
              </p>
            </div>
          </div>
          <AnalyzeNav
            videoId={youtubeId}
            hasTranscriptAnalysis={hasTranscriptAnalysis}
            hasSlideAnalysis={hasSlideAnalysis}
          />
        </div>
      </header>

      {/* Main layout with sidebar on desktop */}
      <div className="flex">
        <AnalyzeLayoutSidebar
          videoId={youtubeId}
          title={videoData.title}
          channelName={videoData.channelName}
          hasTranscriptAnalysis={hasTranscriptAnalysis}
          hasSlideAnalysis={hasSlideAnalysis}
        />

        <main className="flex-1 min-w-0">
          <div className="container max-w-5xl mx-auto px-4 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
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
