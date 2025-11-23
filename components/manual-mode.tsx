"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, Loader2, X, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ManualMode() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [transcriptText, setTranscriptText] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 256 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Video file must be less than 256MB",
        variant: "destructive",
      })
      return
    }

    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, etc.)",
        variant: "destructive",
      })
      return
    }

    setVideoFile(file)
  }

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ["text/plain", "application/json"]
    if (!validTypes.includes(file.type) && !file.name.endsWith(".txt") && !file.name.endsWith(".json")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a TXT or JSON file",
        variant: "destructive",
      })
      return
    }

    setTranscriptFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setTranscriptText(e.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleProcess = async () => {
    if (!videoFile && !transcriptText) {
      toast({
        title: "Missing content",
        description: "Please provide either a video file or a transcript",
        variant: "destructive",
      })
      return
    }

    if (!title.trim()) {
      toast({
        title: "Missing title",
        description: "Please provide a title for this content",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 200)

    setTimeout(() => {
      clearInterval(interval)
      setIsProcessing(false)
      setUploadProgress(0)
      toast({
        title: "Content processed",
        description: "Your content has been successfully added to the knowledge base.",
      })

      // Reset form
      setVideoFile(null)
      setTranscriptFile(null)
      setTranscriptText("")
      setTitle("")
      setNotes("")
    }, 2500)
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Manual Upload
        </CardTitle>
        <CardDescription>Upload your own video and transcript files with additional context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Upload */}
        <div className="space-y-2">
          <Label htmlFor="video-upload">Video File (Optional)</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors bg-muted/30">
            <input
              id="video-upload"
              type="file"
              accept="video/mp4,video/*"
              onChange={handleVideoUpload}
              disabled={isProcessing}
              className="hidden"
            />
            {videoFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Video className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{videoFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(videoFile.size)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setVideoFile(null)} disabled={isProcessing}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label htmlFor="video-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">MP4 or other video formats (max 256MB)</p>
              </label>
            )}
          </div>
        </div>

        {/* Transcript Upload/Paste */}
        <div className="space-y-2">
          <Label htmlFor="transcript-upload">Transcript</Label>
          <div className="border-2 border-dashed rounded-lg p-6 bg-muted/30">
            <input
              id="transcript-upload"
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={handleTranscriptUpload}
              disabled={isProcessing}
              className="hidden"
            />
            {transcriptFile ? (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{transcriptFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(transcriptFile.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setTranscriptFile(null)
                    setTranscriptText("")
                  }}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label htmlFor="transcript-upload" className="cursor-pointer block text-center mb-4">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Upload transcript file</p>
                <p className="text-xs text-muted-foreground">TXT or JSON format</p>
              </label>
            )}

            <div className="relative">
              <Textarea
                id="transcript-text"
                placeholder="Or paste your transcript text here..."
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                disabled={isProcessing}
                className="min-h-32 resize-none bg-background"
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            type="text"
            placeholder="Enter a descriptive title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isProcessing}
            className="h-11"
          />
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes / Context</Label>
          <Textarea
            id="notes"
            placeholder="Add any additional context, notes, or metadata..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isProcessing}
            className="min-h-32 resize-y"
          />
        </div>

        {/* Progress Bar */}
        {isProcessing && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button onClick={handleProcess} disabled={isProcessing} className="w-full h-12 text-base font-medium" size="lg">
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Process Manually"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
