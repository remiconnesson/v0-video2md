"use client";

import { Calendar, Clock, Download, FileText, Youtube } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VideoData {
  title: string;
  description: string;
  duration: string;
  publishedAt: string;
  channelTitle: string;
  thumbnailUrl: string;
  transcriptLength: number;
  markdownUrl?: string;
}

interface VideoInformationProps {
  videoId: string;
  data: VideoData;
}

export function VideoInformation({ videoId, data }: VideoInformationProps) {
  const handleDownloadMarkdown = () => {
    // TODO: Implement markdown download
    console.log("Downloading markdown for video:", videoId);
  };

  const handleDownloadTranscript = () => {
    // TODO: Implement transcript download
    console.log("Downloading transcript for video:", videoId);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
          Video Processed
        </h1>
        <p className="text-muted-foreground text-lg">
          Your video content is ready to use
        </p>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Youtube className="h-5 w-5 text-red-600" />
                {data.title}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {data.description}
              </CardDescription>
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
                <p className="text-xs text-muted-foreground">
                  Transcript Length
                </p>
                <p className="text-sm font-medium">
                  {data.transcriptLength.toLocaleString()} words
                </p>
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
              <Button
                onClick={handleDownloadTranscript}
                variant="outline"
                className="gap-2 h-12 bg-transparent"
              >
                <Download className="h-4 w-4" />
                Download Transcript
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground text-center">
              Content has been added to your knowledge base and is ready for use
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
