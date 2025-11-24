"use client"

import { Calendar, Clock, Download, FileText, Youtube } from "lucide-react"
import { Streamdown } from "streamdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface VideoData {
  title: string
  description: string
  duration: string
  publishedAt: string
  channelTitle: string
  thumbnailUrl: string
  transcriptLength: number
  markdownUrl?: string
}

interface VideoInformationProps {
  videoId: string
  data: VideoData
}

export function VideoInformation({ videoId, data }: VideoInformationProps) {
  const handleDownloadMarkdown = () => {
    // TODO: Implement markdown download
    console.log("Downloading markdown for video:", videoId)
  }

  const handleDownloadTranscript = () => {
    // TODO: Implement transcript download
    console.log("Downloading transcript for video:", videoId)
  }

  const mockMarkdownSummary = `# ${data.title}

## Video Overview

**Channel:** ${data.channelTitle}  
**Duration:** ${data.duration}  
**Published:** ${data.publishedAt}

## Summary

This video provides valuable insights and information. The content has been processed and converted into a structured markdown format for easy reference and integration into your knowledge base.

## Key Points

- **Main Topic**: Understanding the core concepts presented in the video
- **Key Takeaways**: Important lessons and actionable insights
- **Technical Details**: Specific methodologies or techniques discussed
- **Practical Applications**: How to apply the concepts in real-world scenarios

## Detailed Content

### Introduction

The video begins by introducing the main topic and setting the context for the discussion. This section provides background information necessary to understand the deeper concepts explored later.

### Core Concepts

1. **First Concept**: Explanation of the primary idea
2. **Second Concept**: Building upon the foundation
3. **Third Concept**: Advanced applications

### Examples and Use Cases

\`\`\`javascript
// Example code snippet from the video
function processVideo(videoId) {
  return fetch(\`/api/youtube/process\`, {
    method: 'POST',
    body: JSON.stringify({ videoId })
  });
}
\`\`\`

### Conclusion

The video concludes with a summary of key points and suggestions for further exploration.

## Transcript Statistics

- **Total Words**: ${data.transcriptLength.toLocaleString()}
- **Estimated Reading Time**: ${Math.ceil(data.transcriptLength / 200)} minutes
- **Content Type**: Educational/Informational

## Additional Resources

For more information, visit the original video on YouTube or download the full transcript and markdown files using the buttons below.`

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">Video Processed</h1>
        <p className="text-muted-foreground text-lg">Your video content is ready to use</p>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Youtube className="h-5 w-5 text-red-600" />
                {data.title}
              </CardTitle>
              <CardDescription className="line-clamp-2">{data.description}</CardDescription>
            </div>
            <Badge variant="secondary" className="flex-shrink-0">
              Completed
            </Badge>
          </div>
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

          {/* Video Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{data.duration}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Published</p>
                <p className="text-sm font-medium">{data.publishedAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Youtube className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Channel</p>
                <p className="text-sm font-medium">{data.channelTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Transcript Length</p>
                <p className="text-sm font-medium">{data.transcriptLength.toLocaleString()} words</p>
              </div>
            </div>
          </div>

          {/* Download Actions */}
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold">Download Content</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button onClick={handleDownloadMarkdown} className="gap-2 h-12">
                <Download className="h-4 w-4" />
                Download Markdown
              </Button>
              <Button onClick={handleDownloadTranscript} variant="outline" className="gap-2 h-12 bg-transparent">
                <Download className="h-4 w-4" />
                Download Transcript
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Summary
          </CardTitle>
          <CardDescription>Processed markdown content from the video transcript</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown parseIncompleteMarkdown={false}>{mockMarkdownSummary}</Streamdown>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
