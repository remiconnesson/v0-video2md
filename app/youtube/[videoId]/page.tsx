import { VideoWorkflowProgress } from "@/components/video-workflow-progress"
import { VideoInformation } from "@/components/video-information"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>
}) {
  const { videoId } = await params

  // TODO: Replace with actual API call to check workflow status
  const mockWorkflowStatus = {
    isProcessing: true,
    currentStep: 2,
    totalSteps: 4,
    steps: [
      { name: "Fetching video metadata", completed: true },
      { name: "Downloading transcript", completed: true },
      { name: "Processing content", completed: false },
      { name: "Generating markdown", completed: false },
    ],
  }

  // TODO: Replace with actual API call to fetch video data
  const mockVideoData = null // Set to null when processing, or object when ready

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/youtube">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to YouTube Mode
          </Button>
        </Link>

        {mockWorkflowStatus.isProcessing ? (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={mockWorkflowStatus.currentStep}
            totalSteps={mockWorkflowStatus.totalSteps}
            steps={mockWorkflowStatus.steps}
          />
        ) : mockVideoData ? (
          <VideoInformation videoId={videoId} data={mockVideoData} />
        ) : (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={0}
            totalSteps={mockWorkflowStatus.totalSteps}
            steps={mockWorkflowStatus.steps}
          />
        )}
      </div>
    </div>
  )
}
