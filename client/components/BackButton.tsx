import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  label?: string;
  to?: string;
}

export default function BackButton({ className, label = "Back", to }: BackButtonProps) {
  const navigate = useNavigate();
  const onClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-2 border-2 border-primary text-primary bg-background/70 backdrop-blur",
        "hover:bg-primary/15 dark:hover:bg-primary/20",
        "shadow-sm",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </Button>
  );
}
