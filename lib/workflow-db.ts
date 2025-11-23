// Mock in-memory database for workflow status
export interface WorkflowStep {
  name: string;
  completed: boolean;
}

export interface WorkflowData {
  videoId: string;
  isProcessing: boolean;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStep[];
  extractSlides: boolean;
  createdAt: Date;
  completedAt?: Date;
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

// In-memory storage (replace with real database in production)
const workflows = new Map<string, WorkflowData>();

export function getWorkflow(videoId: string): WorkflowData | null {
  return workflows.get(videoId) || null;
}

export function createWorkflow(
  videoId: string,
  extractSlides: boolean,
): WorkflowData {
  const steps: WorkflowStep[] = extractSlides
    ? [
        { name: "Fetching video", completed: false },
        { name: "Downloading Transcript", completed: false },
        { name: "Downloading video", completed: false },
        { name: "Extract slides", completed: false },
        { name: "Processing Content", completed: false },
        { name: "Generating markdown", completed: false },
      ]
    : [
        { name: "Fetching video metadata", completed: false },
        { name: "Downloading transcript", completed: false },
        { name: "Processing content", completed: false },
        { name: "Generating markdown", completed: false },
      ];

  const workflow: WorkflowData = {
    videoId,
    isProcessing: true,
    currentStep: 0,
    totalSteps: steps.length,
    steps,
    extractSlides,
    createdAt: new Date(),
  };

  workflows.set(videoId, workflow);
  return workflow;
}

export function updateWorkflowStep(videoId: string, stepIndex: number) {
  const workflow = workflows.get(videoId);
  if (!workflow) return;

  workflow.steps[stepIndex].completed = true;
  workflow.currentStep = stepIndex + 1;
  workflows.set(videoId, workflow);
}

export function completeWorkflow(
  videoId: string,
  videoData: WorkflowData["videoData"],
) {
  const workflow = workflows.get(videoId);
  if (!workflow) return;

  workflow.isProcessing = false;
  workflow.completedAt = new Date();
  workflow.videoData = videoData;
  workflows.set(videoId, workflow);
}

export function getAllCompletedWorkflows(): WorkflowData[] {
  const completed = Array.from(workflows.values()).filter(
    (workflow) => !workflow.isProcessing && workflow.videoData,
  );
  return completed.sort((a, b) => {
    const dateA = a.completedAt?.getTime() || 0;
    const dateB = b.completedAt?.getTime() || 0;
    return dateB - dateA;
  });
}

function initializeSampleVideos() {
  // Sample video 1
  const video1: WorkflowData = {
    videoId: "dQw4w9WgXcQ",
    isProcessing: false,
    currentStep: 4,
    totalSteps: 4,
    steps: [
      { name: "Fetching video metadata", completed: true },
      { name: "Downloading transcript", completed: true },
      { name: "Processing content", completed: true },
      { name: "Generating markdown", completed: true },
    ],
    extractSlides: false,
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    completedAt: new Date(Date.now() - 86340000),
    videoData: {
      title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
      description: "The official video for Rick Astley's iconic hit song.",
      duration: "3:33",
      publishedAt: "October 25, 2009",
      channelTitle: "Rick Astley",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      transcriptLength: 450,
      markdownUrl: "/downloads/dQw4w9WgXcQ.md",
    },
  };

  // Sample video 2
  const video2: WorkflowData = {
    videoId: "jNQXAC9IVRw",
    isProcessing: false,
    currentStep: 6,
    totalSteps: 6,
    steps: [
      { name: "Fetching video", completed: true },
      { name: "Downloading Transcript", completed: true },
      { name: "Downloading video", completed: true },
      { name: "Extract slides", completed: true },
      { name: "Processing Content", completed: true },
      { name: "Generating markdown", completed: true },
    ],
    extractSlides: true,
    createdAt: new Date(Date.now() - 172800000), // 2 days ago
    completedAt: new Date(Date.now() - 172740000),
    videoData: {
      title: "Me at the zoo",
      description: "The first video ever uploaded to YouTube.",
      duration: "0:19",
      publishedAt: "April 23, 2005",
      channelTitle: "jawed",
      thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
      transcriptLength: 45,
      markdownUrl: "/downloads/jNQXAC9IVRw.md",
    },
  };

  workflows.set(video1.videoId, video1);
  workflows.set(video2.videoId, video2);
}

// Initialize sample videos
initializeSampleVideos();
