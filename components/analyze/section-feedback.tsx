"use client";

import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SectionFeedbackProps {
  videoId: string;
  runId: number;
  sectionKey: string;
}

type Rating = "useful" | "not_useful" | null;

export function SectionFeedback({
  videoId,
  runId,
  sectionKey,
}: SectionFeedbackProps) {
  const [rating, setRating] = useState<Rating>(null);
  const [comment, setComment] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Submit feedback
  const submitFeedback = useCallback(
    async (newRating?: Rating, newComment?: string) => {
      setIsSaving(true);

      try {
        await fetch(`/api/video/${videoId}/analyze/${runId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "section",
            sectionKey,
            rating: newRating ?? rating,
            comment: newComment ?? comment,
          }),
        });
      } catch (err) {
        console.error("Failed to submit feedback:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [videoId, runId, sectionKey, rating, comment],
  );

  // Handle rating click
  const handleRating = (newRating: Rating) => {
    const finalRating = rating === newRating ? null : newRating;
    setRating(finalRating);
    submitFeedback(finalRating);
  };

  // Handle comment submit
  const handleCommentSubmit = () => {
    submitFeedback(rating, comment);
    setCommentOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                rating === "useful" &&
                  "text-green-600 bg-green-100 dark:bg-green-900/30",
              )}
              onClick={() => handleRating("useful")}
              disabled={isSaving}
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Useful</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                rating === "not_useful" &&
                  "text-red-600 bg-red-100 dark:bg-red-900/30",
              )}
              onClick={() => handleRating("not_useful")}
              disabled={isSaving}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Not useful</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Popover open={commentOpen} onOpenChange={setCommentOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", comment && "text-primary")}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm">Add a comment</h4>
              <p className="text-xs text-muted-foreground">
                Help improve future extractions
              </p>
            </div>
            <Textarea
              placeholder="What could be better about this section?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCommentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCommentSubmit}
                disabled={isSaving}
              >
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
