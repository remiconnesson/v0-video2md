import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as workflowApi from "workflow/api";
import type { Logger } from "./workflow-route-utils";
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

  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
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

    const handler = createWorkflowRouteHandler({
      getCompletedResult: mockGetCompletedResult,
      getWorkflowRecord: mockGetWorkflowRecord,
      startWorkflow: mockStartWorkflow,
      extractWorkflowId: mockExtractWorkflowId,
      logger: mockLogger,
    });

    const response = await handler(videoId);

    expect(mockGetWorkflowRecord).toHaveBeenCalledWith(videoId);
    expect(workflowApi.getRun).toHaveBeenCalledWith(workflowId);
    expect(mockStartWorkflow).toHaveBeenCalledWith(videoId);
    expect(response).toBeDefined();

    // Assert logger was called
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Workflow run not found, attempting to restart",
      { videoId, workflowId },
    );
    expect(mockLogger.info).toHaveBeenCalledWith("Workflow restart succeeded", {
      videoId,
      workflowId,
    });
  });

  it("should log error when workflow restart fails", async () => {
    const videoId = "video456" as YouTubeVideoId;
    const workflowId = "wrun_456";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    // Simulate WorkflowRunNotFoundError
    const error = new Error("Workflow run not found");
    error.name = "WorkflowRunNotFoundError";

    const mockRun = {
      status: Promise.reject(error),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    // Make startWorkflow fail
    const restartError = new Error("Failed to start workflow");
    mockStartWorkflow.mockRejectedValueOnce(restartError);

    const handler = createWorkflowRouteHandler({
      getCompletedResult: mockGetCompletedResult,
      getWorkflowRecord: mockGetWorkflowRecord,
      startWorkflow: mockStartWorkflow,
      extractWorkflowId: mockExtractWorkflowId,
      logger: mockLogger,
    });

    await expect(handler(videoId)).rejects.toThrow("Failed to start workflow");

    // Assert logger was called
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Workflow run not found, attempting to restart",
      { videoId, workflowId },
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Workflow restart failed",
      restartError,
      { videoId, workflowId },
    );
  });

  it("should log error when unexpected error occurs", async () => {
    const videoId = "video789" as YouTubeVideoId;
    const workflowId = "wrun_789";

    mockGetWorkflowRecord.mockResolvedValue({ workflowId });

    // Simulate an unexpected error (not WorkflowRunNotFoundError)
    const unexpectedError = new Error("Database connection failed");
    unexpectedError.name = "DatabaseError";

    const mockRun = {
      status: Promise.reject(unexpectedError),
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mocking internal workflow type
    vi.mocked(workflowApi.getRun).mockReturnValue(mockRun as any);

    const handler = createWorkflowRouteHandler({
      getCompletedResult: mockGetCompletedResult,
      getWorkflowRecord: mockGetWorkflowRecord,
      startWorkflow: mockStartWorkflow,
      extractWorkflowId: mockExtractWorkflowId,
      logger: mockLogger,
    });

    await expect(handler(videoId)).rejects.toThrow(
      "Database connection failed",
    );

    // Assert logger.error was called with the unexpected error
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unexpected error while checking workflow status",
      unexpectedError,
      {
        videoId,
        workflowId,
        errorName: "DatabaseError",
        errorCode: undefined,
      },
    );
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
