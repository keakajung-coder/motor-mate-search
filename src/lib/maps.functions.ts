import { createServerFn } from "@tanstack/react-start";
import { parseThaiAddress, type PlaceAddress } from "./place-address";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function gateway(path: string, init: RequestInit & { fieldMask: string }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("ยังไม่ได้เชื่อมต่อ Google Maps");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": init.fieldMask,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Maps request failed [${res.status}]: ${body}`);
    if (res.status === 403) throw new Error("Google Maps ปฏิเสธคำขอ (403) กรุณาตรวจสอบการตั้งค่าคีย์");
    throw new Error(`ค้นหา Google Maps ไม่สำเร็จ (${res.status})`);
  }
  return res.json();
}

export type PlaceHit = { id: string; name: string; address: string };

export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    const query = String(input?.query ?? "").trim().slice(0, 200);
    if (query.length < 2) throw new Error("พิมพ์อย่างน้อย 2 ตัวอักษร");
    return { query };
  })
  .handler(async ({ data }): Promise<PlaceHit[]> => {
    const { requireAccess } = await import("./access-session.server");
    await requireAccess("viewer");
    const json = await gateway("/places/v1/places:searchText", {
      method: "POST",
      fieldMask: "places.id,places.displayName,places.formattedAddress",
      body: JSON.stringify({ textQuery: data.query, languageCode: "th", regionCode: "TH", pageSize: 10 }),
    });
    return (json.places ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
    }));
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((input: { placeId: string }) => {
    const placeId = String(input?.placeId ?? "");
    if (!/^[A-Za-z0-9_-]{5,300}$/.test(placeId)) throw new Error("รหัสสถานที่ไม่ถูกต้อง");
    return { placeId };
  })
  .handler(async ({ data }): Promise<PlaceAddress> => {
    const { requireAccess } = await import("./access-session.server");
    await requireAccess("viewer");
    const p = await gateway(`/places/v1/places/${data.placeId}?languageCode=th&regionCode=TH`, {
      method: "GET",
      fieldMask: "id,displayName,formattedAddress,addressComponents,location,googleMapsUri",
    });
    return parseThaiAddress(p);
  });
