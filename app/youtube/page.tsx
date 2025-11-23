import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { YoutubeMode } from "@/components/youtube-mode";

export default function YouTubePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
            YouTube Mode
          </h1>
          <p className="text-muted-foreground text-lg">
            Extract and process content from YouTube videos
          </p>
        </div>

        <YoutubeMode />
      </div>
    </div>
  );
}
