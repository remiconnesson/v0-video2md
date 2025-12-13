import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AnalyzeView } from "@/components/analyze/analyze-view";
import { Button } from "@/components/ui/button";
import {
  getSortedVersionsDescending,
  parseVersion,
  parseVersions,
} from "@/lib/versions-utils";
import { Effect } from "effect";
import { getAnalysisVersions } from "@/app/actions";
import { parseAsInteger, createLoader } from "nuqs/server";

export const versionSearchParam = createLoader({
  v: parseAsInteger.withDefault(-1),
});

export default async function AnalyzePage(
  props: PageProps<"/video/youtube/[youtubeId]/analyze">,
) {
  const { youtubeId } = await props.params;
  const result = await getAnalysisVersions(youtubeId);
  const { v: versionParam } = await versionSearchParam(props.searchParams);

  if (!result.success) {
    return <ErrorScreen errorMessage={result.error} />;
  }

  const versions = getSortedVersionsDescending(parseVersions(result.versions));
  const displayedVersion = versionParam === -1 ? versions[0] : versionParam;

  if (!versions.includes(displayedVersion)) {
    return <ErrorScreen errorMessage="Invalid version" />;
  }

  return <Layout></Layout>;
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

function ErrorScreen({ errorMessage }: { errorMessage: string }) {
  return <div>Error: {errorMessage}</div>;
}
