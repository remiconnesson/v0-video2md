"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Loader2, Youtube } from "lucide-react"
import { useEffect, useState } from "react"

interface WorkflowStep {
  name: string
  completed: boolean
}

interface VideoWorkflowProgressProps {
  videoId: string
  currentStep: number
  totalSteps: number
  steps: WorkflowStep[]
}

export function VideoWorkflowProgress({ videoId, currentStep, totalSteps, steps }: VideoWorkflowProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Calculate progress percentage
    const completedSteps = steps.filter((step) => step.completed).length
    const progressPercentage = (completedSteps / totalSteps) * 100
    setProgress(progressPercentage)
  }, [steps, totalSteps])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">Processing Video</h1>
        <p className="text-muted-foreground text-lg">Your video is being processed and will be available soon</p>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" />
            Video ID: {videoId}
          </CardTitle>
          <CardDescription>
            Processing step {currentStep} of {totalSteps}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Preview */}
          <div className="rounded-lg overflow-hidden border-2 bg-muted/30">
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Step-by-Step Progress */}
          <div className="space-y-1">
            <h3 className="font-semibold mb-3">Processing Steps</h3>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isActive = index === currentStep - 1 && !step.completed
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isActive ? "bg-accent" : "bg-transparent"
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        step.completed
                          ? "text-foreground font-medium"
                          : isActive
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground text-center">
              This page will automatically update when processing is complete
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
