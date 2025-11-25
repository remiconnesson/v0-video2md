"use client";

import { Info, Loader2, Youtube } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function YoutubeMode() {
  const [url, setUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [extractSlides, setExtractSlides] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!url.trim()) {
      setVideoId(null);
      setValidationError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsValidating(true);
      setValidationError(null);

      try {
        const response = await fetch("/api/youtube/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: url }),
        });

        const data = await response.json();

        if (response.ok && data.videoId) {
          setVideoId(data.videoId);
          setValidationError(null);
        } else {
          setVideoId(null);
          setValidationError(data.error || "Invalid YouTube URL or video ID");
        }
      } catch (error) {
        console.error("Validation error:", error);
        setVideoId(null);
        setValidationError("Failed to validate. Please try again.");
      } finally {
        setIsValidating(false);
      }
    }, 800); // Debounce for 800ms

    return () => clearTimeout(timeoutId);
  }, [url]);

  const handleProcess = async () => {
    if (!videoId) {
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/youtube/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          extractSlides,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process video");
      }

      router.push(`/youtube/${videoId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5" />
          YouTube Video
        </CardTitle>
        <CardDescription>
          Enter a YouTube video URL or video ID to extract and process the
          content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="youtube-url">YouTube URL or Video ID</Label>
          <Input
            id="youtube-url"
            type="text"
            placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isProcessing}
            className="h-12"
          />
          <div className="h-5">
            {isValidating && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating...
              </p>
            )}
            {!isValidating && validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            {!isValidating && videoId && (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Valid YouTube video detected
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Paste any YouTube URL (youtube.com, youtu.be, shorts) or an
            11-character video ID
          </p>
        </div>

        <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted/30">
          <Checkbox
            id="extract-slides"
            checked={extractSlides}
            onCheckedChange={(checked) => setExtractSlides(checked as boolean)}
            disabled={isProcessing}
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="extract-slides"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Extract slides from video
            </Label>
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Requires downloading the video. Slide extraction will take
                significantly longer to process.
              </span>
            </p>
          </div>
        </div>

        <Button
          onClick={handleProcess}
          disabled={!videoId || isProcessing || isValidating}
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

        {!videoId && (
          <div className="rounded-lg overflow-hidden border-2 bg-muted/30">
            <div className="aspect-video w-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Youtube className="h-12 w-12 opacity-20" />
                <p className="text-sm">Video preview will appear here</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
