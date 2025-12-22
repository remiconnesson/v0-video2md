import { ProcessedVideosList } from "@/components/processed-videos-list";
import { TranscriptFetcher } from "@/components/transcript-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-12 max-w-4xl">
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2 md:mb-3 text-balance">
            Knowledge Base Ingestion
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg">
            Import content directly from YouTube videos in just a few clicks
          </p>
        </div>

        <div className="max-w-md mx-auto mb-8 md:mb-12">
          <TranscriptFetcher />
        </div>

        <ProcessedVideosList />
      </div>
    </div>
  );
}
