import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("should re-throw other errors and not swallow them", async () => {
    const videoId = "video456" as YouTubeVideoId;
    const workflowId = "wrun_456";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    // Simulate a different error (not WorkflowRunNotFoundError)
    const error = new Error("Network error");
    error.name = "NetworkError";

    const mockRun = {
      status: Promise.reject(error),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    // Verify that the error is re-thrown
    await expect(handler(videoId)).rejects.toThrow("Network error");

    expect(mockGetWorkflowRecord).toHaveBeenCalledWith(videoId);
    expect(workflowApi.getRun).toHaveBeenCalledWith(workflowId);
    // Verify that startWorkflow was NOT called for non-WorkflowRunNotFoundError
    expect(mockStartWorkflow).not.toHaveBeenCalled();
  });
});
