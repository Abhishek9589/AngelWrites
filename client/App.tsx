import "./global.css";

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Link, Navigate, NavLink } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PoemDetail from "./pages/PoemDetail";
import Favorites from "./pages/Favorites";
import Dashboard from "./pages/Dashboard";
import Manage from "./pages/Manage";
import Themes from "./pages/Themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Analytics } from "@vercel/analytics/react";
import { buttonVariants } from "@/components/ui/button";
import { loadSiteTitle } from "@/lib/site";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient();

function Layout() {
  const [title] = useState<string>(() => loadSiteTitle());

  useEffect(() => {
    document.title = `${title} - Poetry Manager`;
  }, [title]);


  return (
    <div className="min-h-screen pt-24">
      <header className="fixed top-4 left-1/2 z-40 w-[min(1120px,95%)] -translate-x-1/2 rounded-2xl glass">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="https://cdn.builder.io/api/v1/image/assets%2Faddb4921f9a9401eae5d6e57d8e51a79%2F11516b0de05449e998114111d9a9fa80?format=webp&width=64" alt={title} className="h-8 w-8 object-contain" />
            <span className="text-lg font-extrabold tracking-tight gradient-text">{title}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink end to="/" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Home</NavLink>
            <NavLink to="/favorites" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Favorites</NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Dashboard</NavLink>
            <NavLink to="/manage" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Manage</NavLink>
            <NavLink to="/themes" className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }), !isActive && "hover:bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/25")}>Themes</NavLink>
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
            <Route path="themes" element={<Themes />} />
            <Route path="backup" element={<Navigate to="/manage" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
      <Analytics />
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
