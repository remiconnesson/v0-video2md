"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import {
  BookOpen,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import type { Chapter } from "@/ai/transcript-to-book-schema";
import type { TranscriptWorkflowEvent } from "@/app/workflows/fetch-transcript";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { fetchYoutubeVideoTitle } from "@/lib/youtube-utils";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

interface VideoInfo {
  videoId: string;
  url: string;
  title: string;
  channelName?: string;
  description?: string;
  thumbnail?: string;
}

interface BookContent {
  videoSummary: string;
  chapters: Chapter[];
}

type VideoStatus = "not_found" | "processing" | "ready";

interface ProcessingState {
  step: string;
  message: string;
  progress: number;
}

const STEP_PROGRESS: Record<string, number> = {
  fetching: 20,
  saving: 40,
  analyzing: 70,
  finalizing: 90,
};

export function VideoChat({ youtubeId }: { youtubeId: string }) {
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [previousChats, setPreviousChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [processingState, setProcessingState] = useState<ProcessingState>({
    step: "",
    message: "Starting...",
    progress: 0,
  });

  const chatSessionId = currentChatId ?? `${youtubeId}-new`;
  const isReady = videoStatus === "ready" && bookContent !== null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/video/${youtubeId}/chat`,
        body: {
          chatId: currentChatId,
        },
      }),
    [youtubeId, currentChatId],
  );

  const { messages, sendMessage, status } = useChat({
    id: chatSessionId,
    transport,
  });

  // Start the transcript processing workflow and consume the stream
  const startProcessing = useCallback(async () => {
    setVideoStatus("processing");
    setProcessingState({ step: "", message: "Starting...", progress: 5 });

    // Attempt to fetch the video title early to display in the header
    // It's ok if this fails - we'll show "Processing Video..." instead
    fetchYoutubeVideoTitle(youtubeId)
      .then((title) => {
        if (title) {
          setVideo((prev) => ({
            videoId: youtubeId,
            url: `https://www.youtube.com/watch?v=${youtubeId}`,
            title,
            ...(prev || {}),
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to fetch video title:", error);
        // Silently fail - title will remain as "Processing Video..."
      });

    try {
      const response = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start processing");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: TranscriptWorkflowEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                setProcessingState({
                  step: event.step,
                  message: event.message,
                  progress: STEP_PROGRESS[event.step] || 50,
                });
              } else if (event.type === "complete") {
                setBookContent(event.bookContent);
                setVideoStatus("ready");
                setProcessingState({
                  step: "complete",
                  message: "Complete!",
                  progress: 100,
                });
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch {
              // Ignore parse errors for malformed events
            }
          }
        }
      }

      // If we finished without getting a complete event, refetch video data
      if (videoStatus !== "ready") {
        const videoRes = await fetch(`/api/video/${youtubeId}`);
        const data = await videoRes.json();
        if (data.status === "ready") {
          setVideo(data.video);
          setBookContent(data.bookContent);
          setVideoStatus("ready");
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Processing failed";
      setError(errorMessage);
      setVideoStatus(null);
    }
  }, [youtubeId, videoStatus]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        setCurrentChatId(undefined);
        const [videoRes, chatsRes] = await Promise.all([
          fetch(`/api/video/${youtubeId}`),
          fetch(`/api/video/${youtubeId}/chats`),
        ]);

        if (!videoRes.ok) {
          setError(
            `Failed to load video: ${videoRes.statusText || "Unknown error"}`,
          );
          return;
        }

        const videoData = await videoRes.json();

        if (videoData.status === "not_found") {
          setVideoStatus("not_found");
          // Auto-start processing when video not found
          setIsLoading(false);
          startProcessing();
          return;
        }

        if (videoData.status === "processing") {
          setVideo(videoData.video);
          setVideoStatus("processing");
          // Video exists but book content not ready - start processing
          setIsLoading(false);
          startProcessing();
          return;
        }

        // Video is ready
        setVideo(videoData.video);
        setBookContent(videoData.bookContent);
        setVideoStatus("ready");

        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          setPreviousChats(chatsData.chats);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch data";
        console.error("[VideoChat] Error fetching data:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [youtubeId, startProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isReady) return;

    sendMessage({ text: input });
    setInput("");
  };

  // Format book content as markdown
  const formattedContent = useMemo(() => {
    if (!bookContent) return "";

    const parts = [`# Video Summary\n\n${bookContent.videoSummary}\n\n---\n`];

    bookContent.chapters.forEach((chapter, index) => {
      parts.push(
        `## ${index + 1}. ${chapter.chapterTitle}\n\n` +
          `*${chapter.start}*\n\n` +
          `> ${chapter.chapterSummary}\n\n` +
          `${chapter.bookChapter}\n\n---\n`,
      );
    });

    return parts.join("\n");
  }, [bookContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-destructive bg-destructive/10 p-6 max-w-md">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please try refreshing the page.
          </p>
        </Card>
      </div>
    );
  }

  // Processing state UI
  if (videoStatus === "processing" || videoStatus === "not_found") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <h1 className="text-2xl font-bold">
            {video?.title || `Processing Video...`}
          </h1>
          <Button variant="outline" asChild>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              Watch Video
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Processing Progress Card */}
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
              <div className="relative">
                <BookOpen className="h-16 w-16 text-muted-foreground" />
                <Loader2 className="h-8 w-8 animate-spin text-primary absolute -bottom-2 -right-2" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">
                  Analyzing Video Content
                </h2>
                <p className="text-muted-foreground max-w-md">
                  We're fetching the transcript and generating a detailed
                  chapter-by-chapter analysis for you.
                </p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={processingState.progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">
                  {processingState.message}
                </p>
              </div>
            </div>
          </Card>

          {/* Chat Card - Disabled */}
          <Card className="p-4 opacity-50">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">Ask about this video</h3>
            </div>
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">
                Chat will be available once the video analysis is complete.
              </p>
            </div>
            <form className="mt-4 flex gap-2">
              <Input
                placeholder="Ask a question about this video..."
                disabled
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // Ready state UI
  return (
    <div className="space-y-4">
      {video && (
        <div className="flex items-center justify-between pb-4 border-b">
          <h1 className="text-2xl font-bold">{video.title}</h1>
          <Button variant="outline" asChild>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              Watch Video
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-220px)]">
        <Card className="p-6 h-full overflow-hidden">
          <ScrollArea className="h-full">
            <Streamdown>{formattedContent}</Streamdown>
          </ScrollArea>
        </Card>

        <div className="flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">Ask about this video</h3>
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">
                      Start a conversation about this video
                    </p>
                  </div>
                )}

                {messages.map((message) => {
                  const text = message.parts
                    .filter(isTextUIPart)
                    .map((part) => part.text)
                    .join("");

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 max-w-[85%]",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {text}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {status === "streaming" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this video..."
                disabled={status === "streaming"}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || status === "streaming"}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>

          {previousChats.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Previous Chats</h3>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {previousChats.map((chat) => (
                    <button
                      type="button"
                      key={chat.id}
                      onClick={() => setCurrentChatId(chat.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-md hover:bg-accent transition-colors",
                        currentChatId === chat.id && "bg-accent",
                      )}
                    >
                      <p className="text-sm font-medium truncate">
                        {chat.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chat.message_count} messages •{" "}
                        {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
