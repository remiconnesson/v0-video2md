"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Youtube, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function YoutubeMode() {
  const [url, setUrl] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    const id = extractVideoId(value)
    setVideoId(id)
  }

  const handleProcess = async () => {
    if (!videoId) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // TODO: Replace with actual API call to start processing
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Processing started",
        description: "Your video is being processed and will be added to the knowledge base.",
      })

      router.push(`/youtube/${videoId}`)
    }, 1500)
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5" />
          YouTube Video
        </CardTitle>
        <CardDescription>Enter a YouTube URL to extract and process the video content</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="youtube-url">YouTube URL</Label>
          <Input
            id="youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={isProcessing}
            className="h-12"
          />
          <p className="text-sm text-muted-foreground">Supports standard YouTube URLs and youtu.be short links</p>
        </div>

        {videoId && (
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
        )}

        <Button
          onClick={handleProcess}
          disabled={!videoId || isProcessing}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Video...
            </>
          ) : (
            "Process Video"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
