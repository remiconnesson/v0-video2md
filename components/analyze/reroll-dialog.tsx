"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RerollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (instructions: string) => void;
  previousInstructions?: string;
}

export function RerollDialog({
  open,
  onOpenChange,
  onSubmit,
  previousInstructions,
}: RerollDialogProps) {
  const [instructions, setInstructions] = useState("");

  const handleSubmit = () => {
    onSubmit(instructions);
    setInstructions("");
  };

  const handleRunWithoutInstructions = () => {
    onSubmit("");
    setInstructions("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reroll Analysis
          </DialogTitle>
          <DialogDescription>
            Generate a new analysis version. Optionally provide additional
            instructions to guide the extraction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {previousInstructions && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Previous instructions:
              </p>
              <p className="text-sm">{previousInstructions}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="instructions">Additional Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Focus more on actionable insights, include a mermaid diagram showing the process flow, extract any mentioned tools or resources..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be added to the prompt to influence what
              gets extracted.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleRunWithoutInstructions}>
            Run without instructions
          </Button>
          <Button onClick={handleSubmit} disabled={!instructions.trim()}>
            Run with instructions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
