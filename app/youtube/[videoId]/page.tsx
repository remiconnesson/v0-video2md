"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { VideoInformation } from "@/components/video-information";
import { VideoWorkflowProgress } from "@/components/video-workflow-progress";
import type { WorkflowStep } from "@/lib/workflow-db";

interface WorkflowStatus {
  isProcessing: boolean;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStep[];
  videoData?: {
    title: string;
    description: string;
    duration: string;
    publishedAt: string;
    channelTitle: string;
    thumbnailUrl: string;
    transcriptLength: number;
    markdownUrl?: string;
  };
}

export default function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let hasNavigated = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/youtube/status/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkflowStatus(data);

          if (!data.isProcessing && data.videoData && !hasNavigated) {
            hasNavigated = true;
            clearInterval(intervalId);
            // Refresh the page to show the VideoInformation component
            router.refresh();
          }

          // Stop polling when processing is complete
          if (!data.isProcessing && intervalId) {
            clearInterval(intervalId);
          }
        } else {
          setError("Failed to fetch workflow status");
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("[v0] Error fetching status:", err);
        setError("Failed to connect to server");
        clearInterval(intervalId);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every second
    intervalId = setInterval(fetchStatus, 1000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [videoId, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Link href="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workflowStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center">
            <p className="text-muted-foreground">Loading workflow status...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        {workflowStatus.isProcessing ? (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={workflowStatus.currentStep}
            totalSteps={workflowStatus.totalSteps}
            steps={workflowStatus.steps}
          />
        ) : workflowStatus.videoData ? (
          <VideoInformation videoId={videoId} data={workflowStatus.videoData} />
        ) : (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={0}
            totalSteps={workflowStatus.totalSteps}
            steps={workflowStatus.steps}
          />
        )}
      </div>
    </div>
  );
}
