"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";

type ThemeMode = "light" | "dark" | "system";

const options: { value: ThemeMode; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor }
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const current = (theme ?? "system") as ThemeMode;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full bg-background/80 p-1 opacity-0",
          className
        )}
        aria-hidden="true"
      >
        {options.map(option => (
          <span key={option.value} className="h-9 w-9 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-background/80 p-1 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur",
        className
      )}
    >
      {options.map(({ value, icon: Icon }) => {
        const active = current === value;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full text-muted-foreground transition",
              active
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/40"
            )}
            onClick={() => setTheme(value)}
            aria-label={`Switch to ${value} theme`}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
