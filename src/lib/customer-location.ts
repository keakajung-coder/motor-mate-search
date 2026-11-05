import { getGoogleMapsDirUrl } from "./maps";

export type CustomerLocation = {
  address: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  place_id: string;
};

export function customerLocation(customer?: Partial<CustomerLocation> | null): CustomerLocation {
  return {
    address: customer?.address ?? "", subdistrict: customer?.subdistrict ?? "",
    district: customer?.district ?? "", province: customer?.province ?? "",
    postal_code: customer?.postal_code ?? "", latitude: customer?.latitude ?? null,
    longitude: customer?.longitude ?? null, maps_url: customer?.maps_url ?? "",
    place_id: customer?.place_id ?? "",
  };
}

export function fullCustomerAddress(customer?: Partial<CustomerLocation> | null): string {
  if (!customer) return "";
  const address = customer.address?.trim() ?? "";
  const parts = [address];
  for (const [prefix, value] of [["ต.", customer.subdistrict], ["อ.", customer.district], ["จ.", customer.province], ["", customer.postal_code]]) {
    const text = value?.trim();
    if (text && !address.includes(text)) parts.push(`${prefix}${text}`);
  }
  return parts.filter(Boolean).join(" ");
}

export function customerLocationPatch(customer?: Partial<CustomerLocation> | null, fallbackAddress = "") {
  return { customer_address: fullCustomerAddress(customer) || fallbackAddress, customer_location: customerLocation(customer) };
}

export function locationNavigationUrl(location?: Partial<CustomerLocation> | null, fallback = ""): string {
  const lat = location?.latitude;
  const lng = location?.longitude;
  if (typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180) {
    const url = new URL(getGoogleMapsDirUrl(`${lat},${lng}`));
    if (location?.place_id) url.searchParams.set("destination_place_id", location.place_id);
    return url.toString();
  }
  const saved = location?.maps_url?.trim();
  if (saved) {
    try {
      const url = new URL(saved);
      if (url.protocol === "https:" && ["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(url.hostname)) return url.toString();
    } catch { /* Unsafe or malformed URLs fall back to address directions. */ }
  }
  return fallback ? getGoogleMapsDirUrl(fallback) : "";
}