"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { FileVideo, Image as ImageIcon, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

export function ProcessedVideosList() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch("/api/videos");
        if (!response.ok) throw new Error("Failed to fetch videos");
        setVideos(await response.json());
      } catch (error) {
        console.error("Error fetching videos:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, []);

  if (loading) {
    return <SimpleCardLayout>Loading videos...</SimpleCardLayout>;
  }

  if (videos.length === 0) {
    return <SimpleCardLayout>No processed videos yet</SimpleCardLayout>;
  }

  return (
    <SimpleCardLayout descriptionOnly={false}>
      <VideosDataTable data={videos} />
    </SimpleCardLayout>
  );
}

function SimpleCardLayout({
  children,
  title = "Processed Videos",
  descriptionOnly = true,
}: {
  children: React.ReactNode;
  title?: string;
  descriptionOnly?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {descriptionOnly ? (
          <p className="text-muted-foreground text-center py-8">{children}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export interface VideoData {
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
  hasSlideAnalysis: boolean;
  completedAt?: string;
}

function ThumbnailCell({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div className="h-[54px] w-[96px] overflow-hidden rounded-md border bg-muted flex items-center justify-center shrink-0">
      {src ? (
        <Image
          src={src}
          alt={alt || "Video thumbnail"}
          width={96}
          height={54}
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground/20" />
      )}
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

export const columns: ColumnDef<VideoData>[] = [
  {
    id: "thumbnail",
    header: "Thumbnail",
    size: 110,
    cell: ({ row }) => (
      <ThumbnailCell
        src={row.original.videoData?.thumbnail}
        alt={row.original.videoData?.title}
      />
    ),
  },
  {
    id: "videoData.title",
    accessorKey: "videoData.title",
    header: "Title",
    cell: ({ row }) => (
      <Link
        href={`/video/youtube/${row.original.videoId}`}
        className="line-clamp-2 hover:text-primary font-medium"
      >
        {row.original.videoData?.title || "Untitled Video"}
      </Link>
    ),
    filterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true;
      const query = filterValue.toLowerCase();
      const title = row.original.videoData?.title?.toLowerCase() || "";
      const channel = row.original.videoData?.channelName?.toLowerCase() || "";
      const description =
        row.original.videoData?.description?.toLowerCase() || "";
      return (
        title.includes(query) ||
        channel.includes(query) ||
        description.includes(query)
      );
    },
  },
  {
    id: "videoData.channelName",
    accessorKey: "videoData.channelName",
    header: "Channel",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.videoData?.channelName || "Unknown Channel"}
      </span>
    ),
  },
  {
    accessorKey: "hasSlides",
    header: "Slides",
    size: 120,
    cell: ({ row }) => <StatusBadge value={row.original.hasSlides} />,
    filterFn: (row, _columnId, filterValue: string) => {
      if (filterValue === "all") return true;
      return filterValue === "yes"
        ? row.original.hasSlides
        : !row.original.hasSlides;
    },
  },
  {
    accessorKey: "hasAnalysis",
    header: "Analysis",
    size: 120,
    cell: ({ row }) => <StatusBadge value={row.original.hasAnalysis} />,
    filterFn: (row, _columnId, filterValue: string) => {
      if (filterValue === "all") return true;
      return filterValue === "yes"
        ? row.original.hasAnalysis
        : !row.original.hasAnalysis;
    },
  },
  {
    accessorKey: "hasSlideAnalysis",
    header: "Slide AI",
    size: 120,
    cell: ({ row }) => <StatusBadge value={row.original.hasSlideAnalysis} />,
    filterFn: (row, _columnId, filterValue: string) => {
      if (filterValue === "all") return true;
      return filterValue === "yes"
        ? row.original.hasSlideAnalysis
        : !row.original.hasSlideAnalysis;
    },
  },
];

interface VideosDataTableProps {
  data: VideoData[];
}

export function VideosDataTable({ data }: VideosDataTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: { columnFilters },
    initialState: { pagination: { pageSize: 10 } },
  });

  const getFilter = (id: string) =>
    (table.getColumn(id)?.getFilterValue() as string) ?? "";
  const setFilter = (id: string, value: string) =>
    table.getColumn(id)?.setFilterValue(value || undefined);

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(totalRows, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, channel, or description..."
            value={getFilter("videoData.title")}
            onChange={(e) => setFilter("videoData.title", e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3 sm:items-center">
          <FilterSelect
            label="Slides"
            value={getFilter("hasSlides") || "all"}
            onValueChange={(v) => setFilter("hasSlides", v === "all" ? "" : v)}
          />
          <FilterSelect
            label="Analysis"
            value={getFilter("hasAnalysis") || "all"}
            onValueChange={(v) =>
              setFilter("hasAnalysis", v === "all" ? "" : v)
            }
          />
          <FilterSelect
            label="Slide AI"
            value={getFilter("hasSlideAnalysis") || "all"}
            onValueChange={(v) =>
              setFilter("hasSlideAnalysis", v === "all" ? "" : v)
            }
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.getSize() }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No videos found matching your search
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {start}-{end} of {totalRows}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              Last
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-28">
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
