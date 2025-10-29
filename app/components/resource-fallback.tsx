"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ResourceFallbackStatus = "loading" | "not-found" | "error";
type ResourceFallbackAlign = "start" | "center";
type SkeletonVariant = "form" | "detail";

export interface ResourceFallbackProps {
  status: ResourceFallbackStatus;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  skeletonVariant?: SkeletonVariant;
  align?: ResourceFallbackAlign;
  className?: string;
}

const skeletonByVariant: Record<SkeletonVariant, React.ReactNode> = {
  form: (
    <>
      <Skeleton className="h-10 w-48 rounded-full" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-3xl" />
    </>
  ),
  detail: (
    <>
      <Skeleton className="h-10 w-40 rounded-full" />
      <div className="space-y-6">
        <Skeleton className="h-12 w-2/3 rounded-full" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-[360px] w-full rounded-3xl" />
    </>
  )
};

export function ResourceFallback({
  status,
  title,
  description,
  action,
  skeletonVariant = "form",
  align,
  className
}: ResourceFallbackProps) {
  if (status === "loading") {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8",
          className
        )}
      >
        {skeletonByVariant[skeletonVariant]}
      </div>
    );
  }

  const resolvedAlign: ResourceFallbackAlign = align ?? "center";
  const alignmentClass = resolvedAlign === "center" ? "text-center" : "";
  const titleClass =
    resolvedAlign === "center"
      ? "mx-auto text-3xl font-semibold tracking-tight sm:text-4xl"
      : "text-3xl font-semibold tracking-tight sm:text-4xl";
  const descriptionClass =
    resolvedAlign === "center"
      ? "mx-auto max-w-2xl text-sm text-muted-foreground"
      : "max-w-2xl text-sm text-muted-foreground";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-8",
        alignmentClass,
        className
      )}
    >
      {title ? <h1 className={titleClass}>{title}</h1> : null}
      {description ? <div className={descriptionClass}>{description}</div> : null}
      {action ?? null}
    </div>
  );
}
