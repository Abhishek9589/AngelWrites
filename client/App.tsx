import "./global.css";

// Safety shim: wrap ResizeObserver callback to avoid uncaught exceptions
if (typeof window !== 'undefined' && (window as any).ResizeObserver) {
  const NativeRO = (window as any).ResizeObserver;
  try {
    (window as any).ResizeObserver = class ResizeObserverShim extends NativeRO {
      constructor(callback: any) {
        const safe = (entries: any, observer: any) => {
          try {
            callback(entries, observer);
          } catch (e) {
            // swallow ResizeObserver loop errors or any callback errors
            // keep console for visibility
            // eslint-disable-next-line no-console
            console.warn('[ResizeObserver] callback error:', e);
          }
        };
        super(safe);
      }
    };
  } catch (e) {
    // ignore if environment prevents reassigning ResizeObserver
  }
}

import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogProvider } from "@/lib/dialogs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { loadPoems, savePoems } from "@/lib/poems";
import { loadBooks, saveBooks } from "@/lib/books";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { retryImport } from "@/lib/lazy";

const PoemDetail = lazy(() => retryImport(() => import("./pages/PoemDetail")));
const Favorites = lazy(() => retryImport(() => import("./pages/Favorites")));
const Dashboard = lazy(() => retryImport(() => import("./pages/Dashboard")));
const Manage = lazy(() => retryImport(() => import("./pages/Manage")));
const JoinUs = lazy(() => retryImport(() => import("./pages/JoinUs")));

const BookHome = lazy(() => retryImport(() => import("./pages/book/Home")));
const BookLibrary = lazy(() => retryImport(() => import("./pages/book/Library")));
const BookQuill = lazy(() => retryImport(() => import("./pages/book/Quill")));
const BookManage = lazy(() => retryImport(() => import("./pages/book/Manage")));

const queryClient = new QueryClient();

type NavUser = { id: string; username: string; email: string } | null;

function Layout() {
  const [title] = useState<string>(() => loadSiteTitle());
  const location = useLocation();
  const navigate = useNavigate();
  const isBookMode = useMemo(() => location.pathname.startsWith("/book"), [location.pathname]);
  const isEditMode = useMemo(() => location.pathname.startsWith("/book/quill"), [location.pathname]);
  const [authUser, setAuthUser] = useState<NavUser>(() => {
    try { return JSON.parse(localStorage.getItem("aw.auth") || "null"); } catch { return null; }
  });

  useEffect(() => {
    document.title = `${title} - Poetry Manager`;
  }, [title]);

  useEffect(() => {
    const load = () => {
      try { setAuthUser(JSON.parse(localStorage.getItem("aw.auth") || "null")); } catch { setAuthUser(null); }
    };
    load();
    const onAuth = () => load();
    window.addEventListener("aw-auth-changed", onAuth);
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener("aw-auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, []);

  useEffect(() => {
    try { setAuthUser(JSON.parse(localStorage.getItem("aw.auth") || "null")); } catch { setAuthUser(null); }
  }, [location.key]);

  useEffect(() => {
    if (!authUser) return;
    try {
      // Push existing local data to DB for the signed-in user
      const poems = loadPoems();
      savePoems(poems);
      const books = loadBooks();
      saveBooks(books);
    } catch {}
  }, [authUser?.id]);

  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  // Keep dataset.theme in sync with current route context (poem/book) using unified preset storage
  useEffect(() => {
    const root = document.documentElement;
    const ctx = location.pathname.startsWith("/book") ? "book" : "poem";
    const preset = localStorage.getItem(`themePreset_${ctx}`) || "pastel";
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
            onClick={() => { if (isBookMode) navigate("/"); else navigate("/book"); }}
            aria-label="Toggle Poem/Book Mode"
            className="flex items-center gap-2"
          >
            <img src="https://cdn.builder.io/api/v1/image/assets%2Faddb4921f9a9401eae5d6e57d8e51a79%2F11516b0de05449e998114111d9a9fa80?format=webp&width=64" alt={title} className="h-8 w-8 object-contain" />
            <span className="text-lg font-extrabold tracking-tight gradient-text">{title}</span>
          </button>
          <div className="flex items-center gap-1">
            <nav className="hidden md:flex items-center gap-2" aria-label="Primary navigation">
              {isBookMode ? (
                <>
                  <NavLink end to="/book" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Home</NavLink>
                  <NavLink to="/book/library" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Library</NavLink>
                  <NavLink to="/book/quill" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Quill</NavLink>
                  <NavLink to="/book/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Manage</NavLink>
                  <NavLink to="/book/join-us" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Join Us</NavLink>
                </>
              ) : (
                <>
                  <NavLink end to="/" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Home</NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Favorites</NavLink>
                  <NavLink to="/dashboard" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Dashboard</NavLink>
                  <NavLink to="/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Manage</NavLink>
                  <NavLink to="/join-us" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Join Us</NavLink>
                </>
              )}
            </nav>
            {authUser ? (
              <span className="hidden md:inline text-sm text-muted-foreground mr-2" aria-live="polite">hi {authUser.username}</span>
            ) : null}
            <ThemeToggle />
            <Sheet>
              <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="mt-6 grid gap-2">
                  {isBookMode ? (
                    <>
                      <SheetClose asChild>
                        <NavLink end to="/book" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Home</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/book/library" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Library</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/book/quill" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Quill</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/book/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Manage</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/book/join-us" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Join Us</NavLink>
                      </SheetClose>
                    </>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <NavLink end to="/" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Home</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/favorites" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Favorites</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/dashboard" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Dashboard</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Manage</NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink to="/join-us" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "lg" }))}>Join Us</NavLink>
                      </SheetClose>
                    </>
                  )}
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
      <Toaster />
      <DialogProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Index />} />
              <Route path="poem/:id" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><PoemDetail /></Suspense></RouteErrorBoundary>} />
              <Route path="favorites" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Favorites /></Suspense></RouteErrorBoundary>} />
              <Route path="dashboard" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Dashboard /></Suspense></RouteErrorBoundary>} />
              <Route path="manage" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><Manage /></Suspense></RouteErrorBoundary>} />
              <Route path="join-us" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><JoinUs /></Suspense></RouteErrorBoundary>} />
              <Route path="themes" element={<Navigate to="/manage" replace />} />
              <Route path="backup" element={<Navigate to="/manage" replace />} />
            </Route>
            <Route path="/book" element={<Layout />}>
              <Route index element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><BookHome /></Suspense></RouteErrorBoundary>} />
              <Route path="library" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><BookLibrary /></Suspense></RouteErrorBoundary>} />
              <Route path="quill" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><BookQuill /></Suspense></RouteErrorBoundary>} />
              <Route path="manage" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><BookManage /></Suspense></RouteErrorBoundary>} />
              <Route path="join-us" element={<RouteErrorBoundary><Suspense fallback={<LoadingScreen messages={POET_SARCASTIC_MESSAGES} />}><JoinUs /></Suspense></RouteErrorBoundary>} />
              <Route path="themes" element={<Navigate to="/book/manage" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DialogProvider>
    </TooltipProvider>
      <Analytics />
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
