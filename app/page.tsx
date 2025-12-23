import { FileText, LineChart, Sparkles, WandSparkles } from "lucide-react";
import { ProcessedVideosList } from "@/components/processed-videos-list";
import { TranscriptFetcher } from "@/components/transcript-form";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-12 max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-6 shadow-sm backdrop-blur md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.12),_transparent_55%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-5">
              <Badge className="w-fit" variant="secondary">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                AI Knowledge Capture
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-balance">
                  Turn YouTube videos into organized knowledge.
                </h1>
                <p className="text-muted-foreground text-base md:text-lg">
                  Extract transcripts, slide decks, and AI summaries with a
                  single workflow. Bring video insights into your searchable
                  knowledge base in minutes.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <FeatureTag icon={FileText} text="Transcript + slides" />
                <FeatureTag
                  icon={WandSparkles}
                  text="AI summaries & takeaways"
                />
                <FeatureTag icon={LineChart} text="Track processing history" />
              </div>
            </div>
            <div className="max-w-md mx-auto w-full">
              <TranscriptFetcher />
            </div>
          </div>
        </div>

        <div className="mt-10 md:mt-14">
          <ProcessedVideosList />
        </div>
      </div>
    </div>
  );
}

function FeatureTag({
  icon: Icon,
  text,
}: {
  icon: typeof Sparkles;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {text}
    </span>
  );
}
