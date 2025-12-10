import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { PasteTranscriptForm } from "@/components/paste-transcript-form";
import { Button } from "@/components/ui/button";

export default function PastePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <BackHomeButton />

        <PasteModeHeader />

        <div className="grid gap-8">
          <PasteTranscriptForm />

          <HowItWorksCard />
        </div>
      </div>
    </div>
  );
}

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

function PasteModeHeader() {
  return (
    <div className="mb-8 text-center">
      <div className="flex justify-center mb-4">
        <FileText className="h-12 w-12 text-blue-600" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
        Paste Transcript
      </h1>
      <p className="text-muted-foreground text-lg">
        Analyze any transcript directly - podcasts, meetings, conferences, and
        more
      </p>
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">How it works</h2>
      <p className="text-muted-foreground mb-4">
        Paste any plain text transcript along with metadata like title, author,
        and source. Our AI will analyze the content and generate a structured
        summary with custom sections based on what&apos;s most relevant.
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>No YouTube URL required - works with any text content</span>
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>Timestamps are optional - paste raw text from any source</span>
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>
            AI generates custom sections tailored to your content type
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>
            Reroll analysis with additional instructions to refine results
          </span>
        </li>
      </ul>
    </div>
  );
}
