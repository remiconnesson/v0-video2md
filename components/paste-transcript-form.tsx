"use client";

import { useActionState, useEffect } from "use";
import { useRouter } from "next/navigation";
import { createExternalTranscript } from "@/app/paste/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PasteTranscriptForm() {
  const [state, action, isPending] = useActionState(
    createExternalTranscript,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state?.transcriptId) {
      router.push(`/paste/${state.transcriptId}/analyze`);
    }
  }, [state?.success, state?.transcriptId, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paste Your Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {/* Title (required) */}
          <div>
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              name="title"
              id="title"
              required
              disabled={isPending}
              placeholder="e.g., Product Launch Keynote"
            />
          </div>

          {/* Author (optional) */}
          <div>
            <Label htmlFor="author">Author / Speaker</Label>
            <Input
              name="author"
              id="author"
              disabled={isPending}
              placeholder="e.g., Jane Smith"
            />
          </div>

          {/* Source (optional) */}
          <div>
            <Label htmlFor="source">Source</Label>
            <Input
              name="source"
              id="source"
              disabled={isPending}
              placeholder="e.g., TechConf 2024 or Podcast Episode 42"
            />
          </div>

          {/* Description (optional) */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              name="description"
              id="description"
              disabled={isPending}
              rows={3}
              placeholder="Brief summary of the content..."
            />
          </div>

          {/* Transcript (required) */}
          <div>
            <Label htmlFor="transcript">
              Transcript <span className="text-red-500">*</span>
            </Label>
            <Textarea
              name="transcript"
              id="transcript"
              required
              disabled={isPending}
              rows={10}
              placeholder="Paste your transcript here... (plain text, no timestamps required)"
            />
          </div>

          {/* Additional Comments (optional) */}
          <div>
            <Label htmlFor="additional_comments">Additional Comments</Label>
            <Textarea
              name="additional_comments"
              id="additional_comments"
              disabled={isPending}
              rows={2}
              placeholder="Any special context or instructions for future processing..."
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating..." : "Create & Analyze"}
          </Button>
        </form>

        {state?.error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
