import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

function getThemeFallback() {
  try {
    if (document.documentElement.classList.contains("dark")) return "dark";
  } catch {}
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return "system";
}

const Toaster = ({ ...props }) => {
  let theme = getThemeFallback();
  try {
    const t = useTheme()?.theme;
    if (t) theme = t;
  } catch {}

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
