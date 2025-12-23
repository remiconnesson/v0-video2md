import { ProcessedVideosList } from "@/components/processed-videos-list";
import { TranscriptFetcher } from "@/components/transcript-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-12 max-w-4xl">
        <div className="mb-8 md:mb-12 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
            Fast video knowledge extraction
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-balance text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/70">
            Knowledge Base Ingestion
          </h1>
          <p className="mt-3 text-muted-foreground text-sm md:text-lg max-w-xl mx-auto">
            Import content directly from YouTube videos in just a few clicks.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-1 w-24 rounded-full bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
          </div>
        </div>

        <div className="max-w-md mx-auto mb-8 md:mb-12">
          <TranscriptFetcher />
        </div>

        <ProcessedVideosList />
      </div>
    </div>
  );
}
