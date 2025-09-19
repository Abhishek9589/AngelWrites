import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  resetKey?: string | number;
  className?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: any;
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    try {
      // eslint-disable-next-line no-console
      console.error("Route error:", error, errorInfo);
    } catch {}
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      const message = String(this.state.error?.message || this.state.error || "Something went wrong");
      const isChunkError = /Loading chunk|ChunkLoadError|Failed to fetch|dynamic import/i.test(message);
      return (
        <div className={cn("flex items-center justify-center px-4", "min-h-[calc(100vh-6rem)]")}
             role="alert" aria-live="assertive">
          <div className="glass rounded-3xl px-5 py-4 shadow-lg max-w-lg w-full">
            <h2 className="text-base font-semibold">Oops, couldn’t open this page.</h2>
            <p className="mt-1 text-sm text-muted-foreground break-words">{isChunkError ? "A small update was installed. Please refresh to continue." : message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>{isChunkError ? "Refresh" : "Reload"}</Button>
              <Link to="/"><Button variant="outline">Go Home</Button></Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export function RouteErrorBoundary({ children, className, resetKey }: ErrorBoundaryProps) {
  return <ErrorBoundary resetKey={resetKey} className={className}>{children}</ErrorBoundary>;
}

export default RouteErrorBoundary;
