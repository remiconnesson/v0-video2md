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

    expect(mockGetCompletedResult).toHaveBeenCalledWith(videoId);
    expect(mockGetWorkflowRecord).toHaveBeenCalledWith(videoId);
    expect(workflowApi.getRun).toHaveBeenCalledWith(workflowId);
    expect(mockStartWorkflow).toHaveBeenCalledWith(videoId);
    expect(response).toBeDefined();
  });

  it("should restart workflow if run is not found (error code)", async () => {
    const videoId = "video123" as YouTubeVideoId;
    const workflowId = "wrun_123";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    const error = new Error("Workflow run not found");
    (error as any).code = "WorkflowRunNotFoundError"; // Simulate error code

    const mockRun = {
      status: Promise.reject(error),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    await handler(videoId);

    expect(mockStartWorkflow).toHaveBeenCalledWith(videoId);
  });

  it("should rethrow other errors", async () => {
    const videoId = "video123" as YouTubeVideoId;
    const workflowId = "wrun_123";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    const error = new Error("Some other error");

    const mockRun = {
      status: Promise.reject(error),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    await expect(handler(videoId)).rejects.toThrow("Some other error");
    expect(mockStartWorkflow).not.toHaveBeenCalled();
  });
});
