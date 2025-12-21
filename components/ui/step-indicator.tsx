import type * as React from "react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  currentStep: number;
  totalSteps: number;
  message: string;
}

function StepIndicator({
  currentStep,
  totalSteps,
  message,
  className,
  ...props
}: StepIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="font-medium text-foreground">
        Step {currentStep}/{totalSteps}
      </span>
      <span className="text-muted-foreground">:</span>
      <span>{message}</span>
    </div>
  );
}

export { StepIndicator };
