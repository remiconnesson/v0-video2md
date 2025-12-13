"use client";

import { History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VersionSelectorProps {
  versions: number[];
  currentVersion: number;
}

export function VersionSelector({
  versions,
  currentVersion,
}: VersionSelectorProps) {
  if (versions.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>v{currentVersion}</span>
      </div>
    );
  }

  return (
    <Select
      value={currentVersion.toString()}
      onValueChange={(v: string) => {
        // TODO: navigateToVersion(parseInt(v, 10))
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
  );
}
