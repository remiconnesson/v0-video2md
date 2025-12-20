import { ExternalTranscriptAnalyzeView } from "@/components/analyze/external-transcript-analyze-view";

export default async function ExternalTranscriptAnalyzePage(props: {
  params: Promise<{ transcriptId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { transcriptId } = params;
  const { v } = searchParams;
  const version = v ? parseInt(v, 10) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <ExternalTranscriptAnalyzeView
          transcriptId={transcriptId}
          initialVersion={version}
        />
      </div>
    </div>
  );
}
