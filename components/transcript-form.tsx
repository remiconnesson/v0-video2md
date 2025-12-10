"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { validateVideoId } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TranscriptFetcher() {
  const [state, action, isPending] = useActionState(validateVideoId, null);
  const router = useRouter();

  // navigate to the video page after successful transcript fetch
  useEffect(() => {
    if (state?.success && state?.videoId) {
      router.push(`/video/youtube/${state.videoId}/analyze`);
    }
  }, [state?.success, state?.videoId, router]);

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Fetch YouTube Transcript
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <TranscriptForm action={action} isPending={isPending} />
        {state?.error && <ErrorMessage message={state.error} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TranscriptForm({
  action,
  isPending,
}: {
  action: (formData: FormData) => void;
  isPending: boolean;
}) {
  const buttonText = isPending ? "Starting Workflow..." : "Fetch Transcript";

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="videoId">YouTube URL or Video ID</Label>
        <Input
          name="videoId"
          id="videoId"
          placeholder="e.g. https://youtu.be/gN07gbipMoY or gN07gbipMoY"
          disabled={isPending}
          required
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {buttonText}
      </Button>
    </form>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      ❌ {message}
    </div>
  );
}
