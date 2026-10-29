/**
 * Google Maps URL Helpers (Standard Link Scheme - Free, No API Key Required)
 *
 * Uses official universal Google Maps URLs:
 * - Search: https://www.google.com/maps/search/?api=1&query=...
 * - Directions: https://www.google.com/maps/dir/?api=1&destination=...
 */

/** สร้างลิงก์ค้นหา/ปักหมุด Google Maps โดยไม่เสียค่า API */
export function getGoogleMapsUrl(query: string): string {
  const clean = (query ?? "").trim();
  if (!clean) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

/** สร้างลิงก์นำทาง (Directions) ไปยังจุดหมายปลายทางทันที */
export function getGoogleMapsDirUrl(destination: string): string {
  const clean = (destination ?? "").trim();
  if (!clean) return "https://www.google.com/maps";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clean)}`;
}

/**
 * รวมข้อความค้นหาที่เหมาะสมที่สุดจากชื่อลูกค้า ที่อยู่ และสถานที่ติดตั้ง
 */
export function buildLocationQuery(options: {
  customerName?: string | null;
  address?: string | null;
  siteName?: string | null;
  district?: string | null;
  province?: string | null;
}): string {
  const parts: string[] = [];

  // หากมีชื่อสถานที่/โรงงาน ให้ใส่ไว้หน้าสุด
  if (options.siteName && options.siteName.trim()) {
    parts.push(options.siteName.trim());
  }

  // หากมีที่อยู่ชัดเจน
  if (options.address && options.address.trim()) {
    parts.push(options.address.trim());
  } else {
    // รวมอำเภอ จังหวัด ถ้าไม่มีที่อยู่เต็ม
    const subParts = [options.district, options.province].filter(Boolean).map((s) => s!.trim());
    if (subParts.length > 0) parts.push(subParts.join(" "));
  }

  // หากไม่มีที่อยู่เลย ให้ใช้ชื่อลูกค้า
  if (parts.length === 0 && options.customerName && options.customerName.trim()) {
    parts.push(options.customerName.trim());
  }

  return parts.join(" ");
}

/** เปิด Google Maps ในแท็บใหม่ทันที */
export function openInGoogleMaps(query: string) {
  const url = getGoogleMapsUrl(query);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
