"use client";

import { History, RefreshCw } from "lucide-react";
import { useQueryState } from "nuqs";
import {
  VERSION_SEARCH_PARAM_KEY,
  versionSearchParamParsers,
} from "@/app/video/youtube/[youtubeId]/analyze/searchParams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Versions } from "@/lib/versions-utils";
import { getLikelyNextVersion, parseVersion } from "@/lib/versions-utils";
import { Button } from "../ui/button";

interface VersionSelectorProps {
  versions: Versions;
  currentVersion: number;
}

export function VersionSelector({ versions }: VersionSelectorProps) {
  const [version, setVersion] = useQueryState(
    VERSION_SEARCH_PARAM_KEY,
    versionSearchParamParsers.version,
  );

  if (versions.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>v{version}</span>
      </div>
    );
  }

  function handleReroll() {
    setVersion(getLikelyNextVersion(versions));
  }

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      <Select
        value={version.toString()}
        onValueChange={(v: string) => {
          setVersion(parseVersion(v));
        }}
      >
        <SelectTrigger className="w-[120px]">
          <History className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v} value={v.toString()}>
              Version {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={handleReroll} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Reroll
      </Button>
    </div>
  );
}
