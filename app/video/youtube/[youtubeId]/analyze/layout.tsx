import { getCompletedAnalysis, hasSlideAnalysisResults } from "@/db/queries";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { AnalyzeNav } from "./_components/analyze-nav";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home } from "lucide-react";

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold truncate">
                  {videoData.title}
                </h1>
                <p className="text-sm text-muted-foreground">
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
