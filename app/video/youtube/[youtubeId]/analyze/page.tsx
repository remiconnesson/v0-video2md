import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AnalyzeView } from "@/components/analyze/analyze-view";
import { Button } from "@/components/ui/button";

/**
 * Parse and validate version from URL search parameter.
 * We parse version here (in the Server Component) to ensure validation happens
 * before the component tree is rendered, providing better error boundaries
 * and avoiding client-side hydration issues with invalid version values.
 * @param v - Version string from URL search params (e.g., "?v=2")
 * @returns Parsed version number or undefined if not provided
 * @throws Error if version is less than 1
 */
export function parseVersion(v?: string): number | undefined {
  if (!v) {
    return undefined;
  }
  const version = parseInt(v, 10);
  if (version < 1) {
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
  const version = parseVersion(v);

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
