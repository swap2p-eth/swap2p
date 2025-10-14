"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function ChatContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col text-sm", className)} {...props} />
  );
}

export function ChatHeader({
  title,
  description,
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-3", className)}>
      {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ChatList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-3 px-4 py-4", className)} {...props} />;
}

export function ChatMessage({
  role = "user",
  className,
  children
}: React.HTMLAttributes<HTMLDivElement> & {
  role?: "user" | "assistant" | "system";
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end text-right" : "justify-start text-left"
      )}
    >
      <div className={cn("max-w-[75%]", className)}>{children}</div>
    </div>
  );
}

export function ChatInput({
  className,
  children,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("px-4 py-3", className)} {...props}>
      {children}
    </form>
  );
}
