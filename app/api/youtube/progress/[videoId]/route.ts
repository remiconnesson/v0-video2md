import type { NextRequest } from "next/server";
import { getWorkflow, subscribeToWorkflow } from "@/lib/workflow-db";
import type { WorkflowData } from "@/lib/workflow-db";

// Force dynamic execution so each request gets a fresh SSE stream.
export const dynamic = "force-dynamic";
// Target the Node.js runtime because the handler depends on EventEmitter.
export const runtime = "nodejs";

type WorkflowSnapshot = {
  isProcessing: boolean;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowData["steps"];
  videoData: WorkflowData["videoData"];
};

type WorkflowStreamMessage =
  | {
      type: "update";
      payload: WorkflowSnapshot;
    }
  | {
      type: "error";
      payload: {
        message: string;
      };
    };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  if (!videoId) {
    return new Response("Video ID is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let keepAliveId: ReturnType<typeof setInterval> | null = null;

      const sendMessage = (message: WorkflowStreamMessage) => {
        if (closed) {
          return;
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
        );
      };

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;

        if (keepAliveId) {
          clearInterval(keepAliveId);
          keepAliveId = null;
        }

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      const handleUpdate = (workflow: WorkflowData | null) => {
        if (!workflow) {
          sendMessage({
            type: "error",
            payload: { message: "Workflow not found" },
          });
          cleanup();
          return;
        }

        sendMessage({
          type: "update",
          payload: {
            isProcessing: workflow.isProcessing,
            currentStep: workflow.currentStep,
            totalSteps: workflow.totalSteps,
            steps: workflow.steps,
            videoData: workflow.videoData,
          },
        });

        if (!workflow.isProcessing) {
          cleanup();
        }
      };

      unsubscribe = subscribeToWorkflow(videoId, handleUpdate);

      keepAliveId = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }
      }, 15000);

      const currentWorkflow = getWorkflow(videoId);

      if (currentWorkflow) {
        handleUpdate(currentWorkflow);
      } else {
        handleUpdate(null);
      }

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
