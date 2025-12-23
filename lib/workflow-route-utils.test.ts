import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import * as workflowApi from "workflow/api";
import { createWorkflowRouteHandler } from "./workflow-route-utils";
import type { YouTubeVideoId } from "./youtube-utils";

// Mock workflow/api
vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
}));

describe("createWorkflowRouteHandler", () => {
  const mockStartWorkflow = vi
    .fn()
    .mockResolvedValue(new NextResponse("Started"));
  const mockGetCompletedResult = vi.fn().mockResolvedValue(null);
  const mockGetWorkflowRecord = vi.fn();
  const mockExtractWorkflowId = (record: { workflowId: string }) =>
    record.workflowId;

  const handler = createWorkflowRouteHandler({
    getCompletedResult: mockGetCompletedResult,
    getWorkflowRecord: mockGetWorkflowRecord,
    startWorkflow: mockStartWorkflow,
    extractWorkflowId: mockExtractWorkflowId,
  });

  it("should restart workflow if run is not found (WorkflowRunNotFoundError)", async () => {
    const videoId = "video123" as YouTubeVideoId;
    const workflowId = "wrun_123";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    // Simulate WorkflowRunNotFoundError
    const error = new Error("Workflow run not found");
    error.name = "WorkflowRunNotFoundError";

    const mockRun = {
      status: Promise.reject(error),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    const response = await handler(videoId);

    expect(mockGetWorkflowRecord).toHaveBeenCalledWith(videoId);
    expect(workflowApi.getRun).toHaveBeenCalledWith(workflowId);
    expect(mockStartWorkflow).toHaveBeenCalledWith(videoId);
    expect(response).toBeDefined();
  });
});
