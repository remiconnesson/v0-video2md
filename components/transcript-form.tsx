"use client";

import { Loader2 } from "lucide-react";
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

  /**
   * This useEffect handles navigation after successful video ID validation.
   * This is the recommended pattern for Next.js Server Actions with useActionState:
   * - Server actions should only handle data validation/mutation
   * - Client-side effects like navigation should be handled in useEffect
   * - This ensures server actions remain server-only and side-effect free
   */
  useEffect(() => {
    if (state?.success && state?.videoId) {
      // navigate to the video page after validating video id
      router.push(
        `/video/youtube/${state.videoId}/analyze/transcript-analysis`,
      );
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
        <TranscriptForm
          action={action}
          isPending={isPending}
          error={state?.error}
        />
        {state?.error && (
          <ErrorMessage message={state.error} id="transcript-error" />
        )}
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
  error,
}: {
  action: (formData: FormData) => void;
  isPending: boolean;
  error?: string;
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
          aria-invalid={!!error}
          aria-describedby={error ? "transcript-error" : undefined}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="animate-spin" />}
        {buttonText}
      </Button>
    </form>
  );
}

function ErrorMessage({ message, id }: { message: string; id?: string }) {
  return (
    <div
      id={id}
      className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      role="alert"
    >
      ❌ {message}
    </div>
  );
}
