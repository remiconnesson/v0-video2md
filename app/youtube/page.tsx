import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TranscriptFetcher } from "@/components/transcript-form";
import { Button } from "@/components/ui/button";

export default function YouTubePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <BackHomeButton />

        <YouTubeModeHeader />

        <div className="grid gap-8">
          {/* This is what does the logic */}
          <TranscriptFetcher />

          <UserInstructions />
        </div>
      </div>
    </div>
  );
}

// dumb component, just a link
function BackHomeButton() {
  return (
    <Link href="/">
      <Button variant="ghost" className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Button>
    </Link>
  );
}

// dumb component
function YouTubeModeHeader() {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
        YouTube Mode
      </h1>
      <p className="text-muted-foreground text-lg">
        Extract and process content from YouTube videos
      </p>
    </div>
  );
}

// dumb component
function UserInstructions() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">How it works</h2>
      <p className="text-muted-foreground mb-4">
        We run a background workflow to scrape and normalize transcripts without
        blocking your request. You&apos;ll get a run ID immediately after
        submitting a video ID.
      </p>
      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
        <li>Fetch metadata and transcript from Apify.</li>
        <li>
          Normalize the response into channel, video, and transcript data.
        </li>
        <li>UPSERT data into the database (Channel → Video → Transcript).</li>
      </ol>
    </div>
  );
}
