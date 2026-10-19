"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// The app reads the URL and browser APIs on first render, so it only runs in the browser.
const MeetApp = dynamic(() => import("./meet-app"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 flex-col gap-3 p-4 lg:grid lg:grid-cols-[minmax(380px,440px)_1fr]">
      <Skeleton className="h-[38svh] lg:order-2 lg:h-auto" />
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    </div>
  ),
});

export function AppLoader() {
  return <MeetApp />;
}
