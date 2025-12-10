"use client";

import type { VirtualItem } from "@tanstack/react-virtual";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  CheckCircle2, 
  Clock, 
  FileVideo, 
  Search, 
  Brain, 
  Presentation, 
  AlertTriangle, 
  Loader2, 
  Eye, 
  ThumbsUp, 
  ChevronDown, 
  ChevronUp 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
} from "@/components/ui/select";

export interface VideoData {
  videoId: string;
  videoData?: {
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
    channelName: string;
    viewCount: number;
    likeCount: number;
  };
  analysis: {
    status: "pending" | "streaming" | "completed" | "failed";
    version: number;
    hasAnalysis: boolean;
  };
  slides: {
    status: "pending" | "in_progress" | "completed" | "failed";
    totalSlides: number;
    hasSlides: boolean;
  };
  completedAt?: string;
}

type SortColumn = "title" | "channel" | "duration" | "views" | "likes" | "analysis" | "slides" | "date";
type SortDirection = "asc" | "desc";

export function EnhancedVideoTable() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSlides, setFilterSlides] = useState<string>("all");
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

  // Filter and sort videos
  const processedVideos = useMemo(() => {
    return videos
      .filter((video) => {
        // Filter by search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const title = video.videoData?.title?.toLowerCase() || "";
          const channelName = video.videoData?.channelName?.toLowerCase() || "";
          const description = video.videoData?.description?.toLowerCase() || "";

          if (!title.includes(query) && !channelName.includes(query) && !description.includes(query)) {
            return false;
          }
        }

        // Filter by analysis status
        if (filterStatus !== "all") {
          if (filterStatus === "completed" && video.analysis.status !== "completed") return false;
          if (filterStatus === "pending" && video.analysis.status !== "pending") return false;
          if (filterStatus === "failed" && video.analysis.status !== "failed") return false;
          if (filterStatus === "in_progress" && !["streaming", "in_progress"].includes(video.analysis.status)) return false;
        }

        // Filter by slides
        if (filterSlides !== "all") {
          if (filterSlides === "with_slides" && !video.slides.hasSlides) return false;
          if (filterSlides === "no_slides" && video.slides.hasSlides) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortColumn) {
          case "title":
            comparison = (a.videoData?.title || "").localeCompare(b.videoData?.title || "");
            break;
          case "channel":
            comparison = (a.videoData?.channelName || "").localeCompare(b.videoData?.channelName || "");
            break;
          case "duration":
            // Simple comparison based on duration string (could be enhanced)
            comparison = (a.videoData?.duration || "").localeCompare(b.videoData?.duration || "");
            break;
          case "views":
            comparison = (a.videoData?.viewCount || 0) - (b.videoData?.viewCount || 0);
            break;
          case "likes":
            comparison = (a.videoData?.likeCount || 0) - (b.videoData?.likeCount || 0);
            break;
          case "analysis":
            // Sort by analysis status priority
            const statusOrder = { completed: 0, streaming: 1, in_progress: 1, pending: 2, failed: 3 };
            comparison = (statusOrder[a.analysis.status] || 0) - (statusOrder[b.analysis.status] || 0);
            break;
          case "slides":
            comparison = (a.slides.totalSlides || 0) - (b.slides.totalSlides || 0);
            break;
          case "date":
            comparison = new Date(b.completedAt || "").getTime() - new Date(a.completedAt || "").getTime();
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [videos, searchQuery, sortColumn, sortDirection, filterStatus, filterSlides]);

  // Setup virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: processedVideos.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 60, // Estimated height of each table row
    overscan: 5, // Number of items to render outside of the visible area
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />;
  };

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
          Processed Videos ({processedVideos.length})
        </CardTitle>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterSlides} onValueChange={setFilterSlides}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by slides" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Videos</SelectItem>
              <SelectItem value="with_slides">With Slides</SelectItem>
              <SelectItem value="no_slides">No Slides</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {processedVideos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No videos found matching your filters
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden border rounded-lg" ref={scrollContainerRef} style={{ height: "600px", overflow: "auto" }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Video
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("channel")}>
                        <div className="flex items-center">
                          Channel
                          {getSortIndicator("channel")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("duration")}>
                        <div className="flex items-center">
                          Duration
                          {getSortIndicator("duration")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("views")}>
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          Views
                          {getSortIndicator("views")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("likes")}>
                        <div className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Likes
                          {getSortIndicator("likes")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("analysis")}>
                        <div className="flex items-center">
                          <Brain className="h-4 w-4 mr-1" />
                          AI Analysis
                          {getSortIndicator("analysis")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("slides")}>
                        <div className="flex items-center">
                          <Presentation className="h-4 w-4 mr-1" />
                          Slides
                          {getSortIndicator("slides")}
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSort("date")}>
                        <div className="flex items-center">
                          Processed
                          {getSortIndicator("date")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-950 dark:divide-gray-800">
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const video = processedVideos[virtualItem.index];
                      return (
                        <VirtualizedTableRow
                          key={virtualItem.key}
                          virtualItem={virtualItem}
                          video={video}
                          measureElement={virtualizer.measureElement}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

interface VirtualizedTableRowProps {
  virtualItem: VirtualItem;
  video: VideoData;
  measureElement: (node: Element | null) => void;
}

function VirtualizedTableRow({ virtualItem, video, measureElement }: VirtualizedTableRowProps) {
  return (
    <tr
      data-index={virtualItem.index}
      ref={measureElement}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualItem.start}px)`,
      }}
      className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
    >
      <TableCell video={video} />
    </tr>
  );
}

function TableCell({ video }: { video: VideoData }) {
  const thumbnailUrl = video.videoData?.thumbnail || "/placeholder.svg?height=40&width=70";
  const title = video.videoData?.title || "Untitled Video";
  const channelName = video.videoData?.channelName || "Unknown Channel";
  const duration = video.videoData?.duration || "N/A";
  const viewCount = video.videoData?.viewCount || 0;
  const likeCount = video.videoData?.likeCount || 0;
  const processedDate = video.completedAt ? new Date(video.completedAt).toLocaleDateString() : "N/A";

  return (
    <>
      <td className="px-3 py-3 whitespace-nowrap">
        <Link href={`/video/youtube/${video.videoId}`} className="flex items-center gap-3 group">
          <Image
            src={thumbnailUrl}
            alt={title}
            width={70}
            height={40}
            className="w-16 h-9 object-cover rounded"
          />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {title}
            </div>
          </div>
        </Link>
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {channelName}
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {duration}
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm">
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4 text-gray-400" />
          {viewCount.toLocaleString()}
        </div>
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm">
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-4 w-4 text-gray-400" />
          {likeCount.toLocaleString()}
        </div>
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm">
        {getAnalysisStatusBadge(video.analysis.status)}
        {video.analysis.hasAnalysis && video.analysis.version > 1 && (
          <Badge variant="outline" className="ml-1">v{video.analysis.version}</Badge>
        )}
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm">
        {getSlidesStatusBadge(video.slides)}
      </td>
      
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {processedDate}
      </td>
    </>
  );
}

// Helper functions for status badges
function getAnalysisStatusBadge(status: VideoData["analysis"]["status"]) {
  const statusConfig = {
    completed: { text: "Completed", variant: "default" as const, icon: <CheckCircle2 className="h-3 w-3" /> },
    streaming: { text: "In Progress", variant: "secondary" as const, icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    in_progress: { text: "In Progress", variant: "secondary" as const, icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    pending: { text: "Pending", variant: "outline" as const, icon: <Clock className="h-3 w-3" /> },
    failed: { text: "Failed", variant: "destructive" as const, icon: <AlertTriangle className="h-3 w-3" /> },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.text}
    </Badge>
  );
}

function getSlidesStatusBadge(slides: VideoData["slides"]) {
  if (!slides.hasSlides) {
    return <Badge variant="outline">No Slides</Badge>;
  }
  
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Presentation className="h-3 w-3" />
      {slides.totalSlides} slides
    </Badge>
  );
}