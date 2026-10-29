export type PlaceAddress = {
  placeId: string;
  name: string;
  street: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
};

type Component = { longText?: string; types?: string[] };

const clean = (s: string) =>
  s.replace(/^(แขวง|ตำบล|ต\.)\s*/, "").replace(/^(เขต|อำเภอ|อ\.)\s*/, "").replace(/^(จังหวัด|จ\.)\s*/, "").trim();

/** แปลงผล Place Details (Places API New) เป็นฟิลด์ที่อยู่แบบไทย */
export function parseThaiAddress(p: any): PlaceAddress {
  const comps: Component[] = p?.addressComponents ?? [];
  const get = (t: string) => comps.find((c) => c.types?.includes(t))?.longText ?? "";
  const admin2 = get("administrative_area_level_2");
  const sub1 = get("sublocality_level_1");
  const sub2 = get("sublocality_level_2");
  const district = admin2 || sub1;
  const subdistrict = sub2 || (admin2 ? sub1 : "") || get("administrative_area_level_3") || get("locality");
  const street = [get("premise"), get("street_number"), get("route")].filter(Boolean).join(" ");
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  return {
    placeId: p?.id ?? "",
    name: p?.displayName?.text ?? "",
    street: street || p?.displayName?.text || "",
    subdistrict: clean(subdistrict),
    district: clean(district === subdistrict ? "" : district),
    province: clean(get("administrative_area_level_1")),
    postalCode: get("postal_code"),
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
    mapsUrl: p?.googleMapsUri ?? (typeof lat === "number" ? `https://www.google.com/maps?q=${lat},${lng}` : ""),
  };
}
