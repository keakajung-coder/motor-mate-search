import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { getGoogleMapsUrl, buildLocationQuery } from "@/lib/maps";
import { cn } from "@/lib/utils";

interface GoogleMapsPinProps {
  query?: string | null;
  customerName?: string | null;
  address?: string | null;
  siteName?: string | null;
  district?: string | null;
  province?: string | null;
  variant?: "icon" | "badge" | "button";
  size?: "xs" | "sm" | "default";
  className?: string;
  showText?: boolean;
  label?: string;
  title?: string;
}

/**
 * ปุ่มไอคอนหมุด Google Maps นำทาง
 * - กดแล้วเด้งเปิด Google Maps ในแท็บใหม่ทันที (Standard Link ไม่เสียค่า API)
 * - หยุด Event Propagation เพื่อไม่ให้ส่งผลต่อการคลิกการ์ดหลัก
 */
export function GoogleMapsPin({
  query,
  customerName,
  address,
  siteName,
  district,
  province,
  variant = "icon",
  size = "sm",
  className,
  showText = false,
  label,
  title,
}: GoogleMapsPinProps) {
  const searchQuery =
    (query && query.trim()) ||
    buildLocationQuery({
      customerName,
      address,
      siteName,
      district,
      province,
    });

  if (!searchQuery) return null;

  const url = getGoogleMapsUrl(searchQuery);
  const defaultTitle = title || `เปิด Google Maps นำทาง: ${searchQuery}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (variant === "badge") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        title={defaultTitle}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-500 shadow-2xs group cursor-pointer",
          className,
        )}
      >
        <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="truncate max-w-[200px]">{label || "เปิดแผนที่นำทาง"}</span>
      </a>
    );
  }

  if (variant === "button") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        title={defaultTitle}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-background px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/10 hover:border-primary shadow-2xs group cursor-pointer",
          size === "xs" && "px-2 py-0.5 text-[11px]",
          className,
        )}
      >
        <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 group-hover:scale-110 transition-transform" />
        <span>{label || "Google Maps นำทาง"}</span>
      </a>
    );
  }

  // variant === "icon" (default)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title={defaultTitle}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 transition-all cursor-pointer shadow-2xs border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 group",
        size === "xs" && "p-0.5",
        className,
      )}
      aria-label={defaultTitle}
    >
      <MapPin
        className={cn(
          "text-rose-500 group-hover:text-rose-600 group-hover:scale-115 transition-all drop-shadow-xs",
          size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      {showText && (
        <span className="ml-1 text-[11px] font-medium text-foreground/80 group-hover:text-rose-600">
          {label || "แผนที่"}
        </span>
      )}
    </a>
  );
}
