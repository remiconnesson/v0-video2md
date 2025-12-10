import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AnalyzeView } from "@/components/analyze/analyze-view";
import { Button } from "@/components/ui/button";

// TODO test this
// and also test that the component is calling this function
// Tracked in TODOS.md - Issue #4
export function parseVersion(v?: string): number | undefined {
  // TODO: add why we do care about parsing version this here
  // Tracked in TODOS.md - Issue #5
  const version = v ? parseInt(v, 10) : undefined;
  if (version && version < 1) {
    throw new Error("Version must be greater than or equal to 1");
  }
  return version;
}

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ youtubeId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { youtubeId } = await params;
  const { v } = await searchParams;
  // TODO: version shouldn't be less than 1
  // Tracked in TODOS.md - Issue #6
  const version = v ? parseInt(v, 10) : undefined;

  return (
    <Layout>
      <AnalyzeView youtubeId={youtubeId} initialVersion={version} />
    </Layout>
  );
}

// dumb component with just a link
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
