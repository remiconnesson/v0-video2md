"use client";

import { CheckCircle2, Clock, FileVideo } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoData {
  videoId: string;
  videoData?: {
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
  };
  extractSlides: boolean;
  completedAt?: string;
}

export function ProcessedVideosList() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch("/api/youtube/list");
        if (response.ok) {
          const data = await response.json();
          setVideos(data.videos);
        }
      } catch (error) {
        console.error("[v0] Error fetching videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();

    // Poll for updates every 5 seconds
    const intervalId = setInterval(fetchVideos, 5000);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Processed Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Loading videos...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Processed Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No processed videos yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="h-5 w-5" />
          Processed Videos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {videos.map((video) => (
            <Link
              key={video.videoId}
              href={`/youtube/${video.videoId}`}
              className="block group"
            >
              <div className="flex gap-4 p-4 rounded-lg border hover:bg-accent transition-colors">
                <div className="flex-shrink-0">
                  <Image
                    src={
                      video.videoData?.thumbnail ||
                      "/placeholder.svg?height=90&width=160"
                    }
                    alt={video.videoData?.title || "Video thumbnail"}
                    width={160}
                    height={90}
                    className="w-40 h-24 object-cover rounded"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-2 truncate group-hover:text-primary transition-colors">
                    {video.videoData?.title || "Untitled Video"}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {video.videoData?.description || "No description available"}
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{video.videoData?.duration || "N/A"}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </Badge>
                    {video.extractSlides && (
                      <Badge variant="outline">With Slides</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
