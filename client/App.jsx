import "./global.css";

// Safety shim: wrap ResizeObserver callback to avoid uncaught exceptions
if (typeof window !== "undefined" && window.ResizeObserver) {
  const NativeRO = window.ResizeObserver;
  try {
    window.ResizeObserver = class ResizeObserverShim extends NativeRO {
      constructor(callback) {
        const safe = (entries, observer) => {
          try {
            callback(entries, observer);
          } catch (e) {
            // swallow ResizeObserver loop errors or any callback errors
            // eslint-disable-next-line no-console
            console.warn("[ResizeObserver] callback error:", e);
          }
        };
        super(safe);
      }
    };
  } catch (e) {
    // ignore if environment prevents reassigning ResizeObserver
  }
}

import { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogProvider } from "@/lib/dialogs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Analytics } from "@vercel/analytics/react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { loadSiteTitle } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/loading";
import { POET_SARCASTIC_MESSAGES } from "@/lib/messages";

const PoemDetail = lazy(() => import("./pages/PoemDetail"));
const Library = lazy(() => import("./pages/Library"));
const Quill = lazy(() => import("./pages/Quill"));
const Manage = lazy(() => import("./pages/Manage"));
const BookDetail = lazy(() => import("./pages/BookDetail"));

const queryClient = new QueryClient();

function Layout() {
  const [title] = useState(() => loadSiteTitle());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${title} - Poetry Manager`;
  }, [title]);

  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  // Keep dataset.theme for poem context
  useEffect(() => {
    const root = document.documentElement;
    const preset = localStorage.getItem(`themePreset_poem`) || "pastel";
    root.dataset.theme = preset;
  }, [location.pathname]);

  return (
    <div className={cn("min-h-screen pt-24")}>
      <header
        className={cn(
          "z-40 w-[min(1120px,95%)] rounded-2xl glass fixed top-4 left-1/2 -translate-x-1/2"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => { navigate("/"); }}
            aria-label="Go Home"
            className="flex items-center gap-2"
          >
            <img src="https://cdn.builder.io/api/v1/image/assets%2Faddb4921f9a9401eae5d6e57d8e51a79%2F11516b0de05449e998114111d9a9fa80?format=webp&width=64" alt={title} className="h-8 w-8 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.svg'; }} />
            <span className="text-lg font-extrabold tracking-tight gradient-text">{title}</span>
          </button>
          <div className="flex items-center gap-1">
            <nav className="hidden md:flex items-center gap-2" aria-label="Primary navigation">
              <NavLink end to="/" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Home</NavLink>
              <NavLink to="/library" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Library</NavLink>
              <NavLink to="/quill" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Quill</NavLink>
              <NavLink to="/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Manage</NavLink>
            </nav>
            <ThemeToggle />
            <Sheet>
              <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="mt-6 grid gap-2">
                  <SheetClose asChild>
                    <NavLink end to="/" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Home</NavLink>
                  </SheetClose>
                  <SheetClose asChild>
                    <NavLink to="/library" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Library</NavLink>
                  </SheetClose>
                  <SheetClose asChild>
                    <NavLink to="/quill" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Quill</NavLink>
                  </SheetClose>
                  <SheetClose asChild>
                    <NavLink to="/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Manage</NavLink>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <DialogProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Index />} />
              <Route path="poem/:id" element={<Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><PoemDetail /></Suspense>} />
              <Route path="book/:id" element={<Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><BookDetail /></Suspense>} />
              <Route path="library" element={<Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Library /></Suspense>} />
              <Route path="quill" element={<Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Quill /></Suspense>} />
              <Route path="manage" element={<Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Manage /></Suspense>} />
              <Route path="backup" element={<Navigate to="/manage" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DialogProvider>
    </TooltipProvider>
      <Analytics />
  </QueryClientProvider>
);

createRoot(document.getElementById("root")).render(<App />);
