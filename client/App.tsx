import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Link, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PoemDetail from "./pages/PoemDetail";
import Favorites from "./pages/Favorites";
import Dashboard from "./pages/Dashboard";
import Manage from "./pages/Manage";
import { ThemeToggle } from "@/components/ThemeToggle";

const queryClient = new QueryClient();

function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-fuchsia-500" />
            <span className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent-foreground)))]">angelhub</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link className="px-3 py-2 rounded-md text-sm hover:bg-accent" to="/">Home</Link>
            <Link className="px-3 py-2 rounded-md text-sm hover:bg-accent" to="/favorites">Favorites</Link>
            <Link className="px-3 py-2 rounded-md text-sm hover:bg-accent" to="/dashboard">Dashboard</Link>
            <Link className="px-3 py-2 rounded-md text-sm hover:bg-accent" to="/manage">Manage</Link>
            <ThemeToggle />
          </nav>
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
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Index />} />
            <Route path="poem/:id" element={<PoemDetail />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="manage" element={<Manage />} />
            <Route path="backup" element={<Navigate to="/manage" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
