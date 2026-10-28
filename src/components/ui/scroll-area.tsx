import * as React from "react";

import { cn } from "@/lib/utils";

// กล่องเลื่อนแบบ div ปกติ (แทน Radix ScrollArea) เพื่อให้ปัดนิ้วบน iOS/iPadOS ได้
// แถบเลื่อนวาดโดย OverlayScrollbarLayer (คลาส force-scrollbar) และยังลากได้
const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative force-scrollbar osb-swipe", className)} {...props}>
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

const ScrollBar = (_props: { orientation?: "vertical" | "horizontal"; className?: string }) =>
  null;

export { ScrollArea, ScrollBar };
