import React, { useRef } from "react";
import { cn } from "@/lib/utils";

type LoadingScreenProps = {
  label?: string;
  fullscreen?: boolean;
  className?: string;
  messages?: string[];
};

let __lastLoadingMessage: string | null = null;

export function LoadingScreen({ label = "Loading…", fullscreen = true, className, messages }: LoadingScreenProps) {
  const displayedRef = useRef<string | null>(null);

  if (!displayedRef.current) {
    if (messages && messages.length > 0) {
      let i = Math.floor(Math.random() * messages.length);
      if (messages.length > 1) {
        let attempts = 0;
        while (messages[i] === __lastLoadingMessage && attempts < 8) {
          i = Math.floor(Math.random() * messages.length);
          attempts++;
        }
      }
      displayedRef.current = messages[i];
      __lastLoadingMessage = displayedRef.current;
    } else {
      displayedRef.current = label;
      __lastLoadingMessage = displayedRef.current;
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4",
        fullscreen ? "min-h-[calc(100vh-6rem)]" : "h-full",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="glass rounded-3xl px-5 py-3 flex items-center gap-3 shadow-lg">
        <span
          className="inline-block size-4 md:size-5 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
        <span className="text-sm md:text-base">{displayedRef.current}</span>
      </div>
    </div>
  );
}

export default LoadingScreen;
