// Mock in-memory database for workflow status
export interface WorkflowStep {
  name: string
  completed: boolean
}

export interface WorkflowData {
  videoId: string
  isProcessing: boolean
  currentStep: number
  totalSteps: number
  steps: WorkflowStep[]
  extractSlides: boolean
  createdAt: Date
  completedAt?: Date
  videoData?: {
    title: string
    description: string
    duration: string
    thumbnail: string
    markdownContent: string
  }
}

// In-memory storage (replace with real database in production)
const workflows = new Map<string, WorkflowData>()

export function getWorkflow(videoId: string): WorkflowData | null {
  return workflows.get(videoId) || null
}

export function createWorkflow(videoId: string, extractSlides: boolean): WorkflowData {
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
      ]

  const workflow: WorkflowData = {
    videoId,
    isProcessing: true,
    currentStep: 0,
    totalSteps: steps.length,
    steps,
    extractSlides,
    createdAt: new Date(),
  }

  workflows.set(videoId, workflow)
  return workflow
}

export function updateWorkflowStep(videoId: string, stepIndex: number) {
  const workflow = workflows.get(videoId)
  if (!workflow) return

  workflow.steps[stepIndex].completed = true
  workflow.currentStep = stepIndex + 1
  workflows.set(videoId, workflow)
}

export function completeWorkflow(videoId: string, videoData: WorkflowData["videoData"]) {
  const workflow = workflows.get(videoId)
  if (!workflow) return

  workflow.isProcessing = false
  workflow.completedAt = new Date()
  workflow.videoData = videoData
  workflows.set(videoId, workflow)
}
