"use client";

import { FileVideo, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VideoData {
  videoId: string;
  videoData?: {
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
    channelName: string;
  };
  hasSlides: boolean;
  hasAnalysis: boolean;
  completedAt?: string;
}

type FilterOption = "all" | "yes" | "no";

export function ProcessedVideosList() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [slidesFilter, setSlidesFilter] = useState<FilterOption>("all");
  const [analysisFilter, setAnalysisFilter] = useState<FilterOption>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

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
    const query = searchQuery.trim().toLowerCase();

    return videos.filter((video) => {
      const title = video.videoData?.title?.toLowerCase() || "";
      const channelName = video.videoData?.channelName?.toLowerCase() || "";
      const description = video.videoData?.description?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        title.includes(query) ||
        channelName.includes(query) ||
        description.includes(query);

      const matchesSlides = matchesFilter(video.hasSlides, slidesFilter);
      const matchesAnalysis = matchesFilter(video.hasAnalysis, analysisFilter);

      return matchesSearch && matchesSlides && matchesAnalysis;
    });
  }, [videos, searchQuery, slidesFilter, analysisFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);

  useEffect(() => {
    if (pageIndex !== currentPageIndex) {
      setPageIndex(currentPageIndex);
    }
  }, [currentPageIndex, pageIndex]);

  const paginatedVideos = useMemo(() => {
    const start = currentPageIndex * pageSize;
    const end = start + pageSize;
    return filteredVideos.slice(start, end);
  }, [currentPageIndex, filteredVideos, pageSize]);

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
        <ProcessedVideosFilters
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setPageIndex(0);
          }}
          slidesFilter={slidesFilter}
          onSlidesFilterChange={(value) => {
            setSlidesFilter(value);
            setPageIndex(0);
          }}
          analysisFilter={analysisFilter}
          onAnalysisFilterChange={(value) => {
            setAnalysisFilter(value);
            setPageIndex(0);
          }}
        />
      </CardHeader>
      <CardContent>
        {filteredVideos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No videos found matching your search
          </p>
        ) : (
          <div className="space-y-4">
            <ProcessedVideosTable videos={paginatedVideos} />
            <ProcessedVideosPagination
              totalItems={filteredVideos.length}
              pageIndex={currentPageIndex}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPageIndex}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPageIndex(0);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components for better readability
// ============================================================================

function matchesFilter(value: boolean, filter: FilterOption) {
  if (filter === "all") {
    return true;
  }

  return filter === "yes" ? value : !value;
}

interface ProcessedVideosFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  slidesFilter: FilterOption;
  onSlidesFilterChange: (value: FilterOption) => void;
  analysisFilter: FilterOption;
  onAnalysisFilterChange: (value: FilterOption) => void;
}

function ProcessedVideosFilters({
  searchQuery,
  onSearchChange,
  slidesFilter,
  onSlidesFilterChange,
  analysisFilter,
  onAnalysisFilterChange,
}: ProcessedVideosFiltersProps) {
  return (
    <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by title, channel, or description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <FilterSelect
          label="Slides"
          value={slidesFilter}
          onValueChange={onSlidesFilterChange}
        />
        <FilterSelect
          label="Analysis"
          value={analysisFilter}
          onValueChange={onAnalysisFilterChange}
        />
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: FilterOption;
  onValueChange: (value: FilterOption) => void;
}

function FilterSelect({ label, value, onValueChange }: FilterSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Select
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue as FilterOption)}
      >
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ProcessedVideosTable({ videos }: { videos: VideoData[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Thumbnail</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="w-[120px]">Slides</TableHead>
            <TableHead className="w-[120px]">Analysis</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow key={video.videoId}>
              <TableCell>
                <ThumbnailCell
                  src={video.videoData?.thumbnail}
                  alt={video.videoData?.title}
                />
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/video/youtube/${video.videoId}`}
                  className="line-clamp-2 hover:text-primary"
                >
                  {video.videoData?.title || "Untitled Video"}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {video.videoData?.channelName || "Unknown Channel"}
              </TableCell>
              <TableCell>
                <StatusBadge value={video.hasSlides} />
              </TableCell>
              <TableCell>
                <StatusBadge value={video.hasAnalysis} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface ProcessedVideosPaginationProps {
  totalItems: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function ProcessedVideosPagination({
  totalItems,
  pageIndex,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ProcessedVideosPaginationProps) {
  const start = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(totalItems, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalItems}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(0)}
            disabled={pageIndex === 0}
          >
            First
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onPageChange(Math.min(totalPages - 1, pageIndex + 1))
            }
            disabled={pageIndex >= totalPages - 1}
          >
            Next
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={pageIndex >= totalPages - 1}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThumbnailCell({ src, alt }: { src?: string; alt?: string }) {
  const thumbnailUrl = src || "/placeholder.svg?height=90&width=160";
  const altText = alt || "Video thumbnail";

  return (
    <div className="h-[54px] w-[96px] overflow-hidden rounded-md border bg-muted/20">
      <Image
        src={thumbnailUrl}
        alt={altText}
        width={96}
        height={54}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function StatusBadge({ value }: { value: boolean }) {
  return value ? (
    <Badge variant="secondary">Yes</Badge>
  ) : (
    <Badge variant="outline">No</Badge>
  );
}
