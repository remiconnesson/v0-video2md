"use client";

import type { VirtualItem } from "@tanstack/react-virtual";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, Clock, FileVideo, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface VideoData {
  videoId: string;
  videoData?: {
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
    channelName: string;
  };
  extractSlides: boolean;
  completedAt?: string;
}

export function ProcessedVideosList() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch("/api/videos");
        if (!response.ok) {
          throw new Error("Failed to fetch videos");
        }
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error("Error fetching videos:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  // Filter videos based on search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) {
      return videos;
    }

    const query = searchQuery.toLowerCase();
    return videos.filter((video) => {
      const title = video.videoData?.title?.toLowerCase() || "";
      const channelName = video.videoData?.channelName?.toLowerCase() || "";
      const description = video.videoData?.description?.toLowerCase() || "";

      return (
        title.includes(query) ||
        channelName.includes(query) ||
        description.includes(query)
      );
    });
  }, [videos, searchQuery]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: filteredVideos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Estimated height of each video card
    overscan: 3, // Number of items to render outside of the visible area
  });

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
          Processed Videos ({filteredVideos.length})
        </CardTitle>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, channel, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredVideos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No videos found matching your search
          </p>
        ) : (
          <div
            ref={parentRef}
            className="h-[600px] overflow-auto"
            style={{
              contain: "strict",
            }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const video = filteredVideos[virtualItem.index];
                return (
                  <VirtualizedVideoCard
                    key={virtualItem.key}
                    virtualItem={virtualItem}
                    video={video}
                    measureElement={virtualizer.measureElement}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components for better readability
// ============================================================================

interface VirtualizedVideoCardProps {
  virtualItem: VirtualItem;
  video: VideoData;
  measureElement: (node: Element | null) => void;
}

function VirtualizedVideoCard({
  virtualItem,
  video,
  measureElement,
}: VirtualizedVideoCardProps) {
  return (
    <div
      data-index={virtualItem.index}
      ref={measureElement}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualItem.start}px)`,
      }}
    >
      <div className="pb-4">
        <VideoCard video={video} />
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: VideoData }) {
  const thumbnailUrl =
    video.videoData?.thumbnail || "/placeholder.svg?height=90&width=160";
  const title = video.videoData?.title || "Untitled Video";
  const channelName = video.videoData?.channelName || "Unknown Channel";
  const description =
    video.videoData?.description || "No description available";
  const duration = video.videoData?.duration || "N/A";

  return (
    <Link href={`/video/youtube/${video.videoId}`} className="block group">
      <div className="flex gap-4 p-4 rounded-lg border hover:bg-accent transition-colors">
        <VideoThumbnail src={thumbnailUrl} alt={title} />
        <VideoDetails
          title={title}
          channelName={channelName}
          description={description}
          duration={duration}
          hasSlides={video.extractSlides}
        />
      </div>
    </Link>
  );
}

function VideoThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex-shrink-0">
      <Image
        src={src}
        alt={alt}
        width={160}
        height={90}
        className="w-40 h-24 object-cover rounded"
      />
    </div>
  );
}

function VideoDetails({
  title,
  channelName,
  description,
  duration,
  hasSlides,
}: {
  title: string;
  channelName: string;
  description: string;
  duration: string;
  hasSlides: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-primary transition-colors">
        {title}
      </h3>

      <p className="text-sm text-muted-foreground mb-2">{channelName}</p>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {description}
      </p>

      <VideoMetadata duration={duration} hasSlides={hasSlides} />
    </div>
  );
}

function VideoMetadata({
  duration,
  hasSlides,
}: {
  duration: string;
  hasSlides: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{duration}</span>
      </div>

      <Badge variant="secondary" className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>

      {hasSlides && <Badge variant="outline">With Slides</Badge>}
    </div>
  );
}
