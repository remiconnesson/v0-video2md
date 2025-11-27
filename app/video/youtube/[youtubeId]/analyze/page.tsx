import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AnalyzeView } from "@/components/analyze/analyze-view";
import { Button } from "@/components/ui/button";

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ youtubeId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { youtubeId } = await params;
  const { v } = await searchParams;
  const version = v ? parseInt(v, 10) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/video/youtube/${youtubeId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Video
            </Button>
          </Link>
        </div>

        <AnalyzeView youtubeId={youtubeId} initialVersion={version} />
      </div>
    </div>
  );
}
