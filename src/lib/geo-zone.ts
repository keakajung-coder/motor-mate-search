/**
 * ระบบวิเคราะห์และจัดกลุ่มงานตามพื้นที่ (Zone / District Analyzer)
 *
 * ดึงข้อมูลจังหวัด อำเภอ/เขต หรือนิคมอุตสาหกรรม จากที่อยู่หรือข้อมูลเครื่องจักร
 * เพื่อจัดกลุ่มงานในโซนใกล้เคียงกัน และเชื่อมโยงกับทะเบียนรถที่วิ่งแต่ละโซน
 */

// รายชื่อจังหวัดและนิคมยอดนิยมในภาคกลางและภาคตะวันออก (โซนอุตสาหกรรมหลัก)
const KNOWN_PROVINCES = [
  "สมุทรปราการ",
  "ชลบุรี",
  "ระยอง",
  "ฉะเชิงเทรา",
  "ปทุมธานี",
  "นนทบุรี",
  "กรุงเทพมหานคร",
  "กรุงเทพฯ",
  "พระนครศรีอยุธยา",
  "อยุธยา",
  "สระบุรี",
  "นครปฐม",
  "สมุทรสาคร",
  "ปราจีนบุรี",
  "นครนายก",
  "ลพบุรี",
  "นครราชสีมา",
  "ขอนแก่น",
  "เชียงใหม่",
  "ราชบุรี",
  "เพชรบุรี",
  "จันทบุรี",
];

const KNOWN_ESTATES = [
  "นิคมบางปู",
  "นิคมบางพลี",
  "นิคมอมตะนคร",
  "นิคมอมตะซิตี้",
  "นิคมแหลมฉบัง",
  "นิคมเวลโกรว์",
  "นิคมอีสเทิร์นซีบอร์ด",
  "นิคมโรจนะ",
  "นิคมนวนคร",
  "นิคมไฮเทค",
  "นิคมลาดกระบัง",
  "นิคมสินสาคร",
  "นิคมมาบตาพุด",
  "นิคมเกตเวย์",
  "นิคมพินทอง",
  "นิคมเอเซีย",
  "นิคมพัฒนา",
];

export type ZoneInfo = {
  zoneKey: string;
  zoneName: string;
  province: string;
  district: string;
};

/**
 * วิเคราะห์หาจังหวัด อำเภอ หรือโซนจากที่อยู่
 */
export function extractZoneInfo(
  address?: string | null,
  fallbackProvince?: string | null,
  fallbackDistrict?: string | null,
): ZoneInfo {
  const addr = (address ?? "").trim();

  let province = (fallbackProvince ?? "").trim();
  let district = (fallbackDistrict ?? "").trim();
  let estate = "";

  // 1. ตรวจหานิคมอุตสาหกรรม
  for (const est of KNOWN_ESTATES) {
    if (addr.includes(est)) {
      estate = est;
      break;
    }
  }

  // 2. ตรวจหาจังหวัด
  if (!province) {
    for (const p of KNOWN_PROVINCES) {
      if (addr.includes(p)) {
        province = p === "อยุธยา" ? "พระนครศรีอยุธยา" : p === "กรุงเทพมหานคร" ? "กรุงเทพฯ" : p;
        break;
      }
    }
    // หาจาก จ. หรือ จังหวัด
    if (!province) {
      const matchProv = addr.match(/(?:จ\.|จังหวัด)\s*([ก-๙]+)/);
      if (matchProv && matchProv[1]) {
        province = matchProv[1].trim();
      }
    }
  }

  // 3. ตรวจหาอำเภอ หรือ เขต
  if (!district) {
    const matchDist = addr.match(/(?:อ\.|อำเภอ|เขต)\s*([ก-๙]+)/);
    if (matchDist && matchDist[1]) {
      const name = matchDist[1].trim();
      district = addr.includes("เขต") ? `เขต${name}` : `อ.${name}`;
    } else {
      // ค้นหาคีย์เวิร์ดอำเภอยอดนิยม
      const popularDistricts = [
        "บางพลี",
        "บางเสาธง",
        "บางบ่อ",
        "พระประแดง",
        "ศรีราชา",
        "พานทอง",
        "บ้านบึง",
        "เมือง",
        "ปลวกแดง",
        "บางนา",
        "บางปะกง",
        "คลองหลวง",
        "ธัญบุรี",
        "ลำลูกกา",
        "กระทุ่มแบน",
      ];
      for (const d of popularDistricts) {
        if (addr.includes(d)) {
          district = d === "บางนา" ? "เขตบางนา" : `อ.${d}`;
          break;
        }
      }
    }
  }

  // สร้างชื่อ Zone Name ที่เข้าใจง่าย
  let zoneName = "";
  if (province && (estate || district)) {
    zoneName = `${province} · ${estate || district}`;
  } else if (estate) {
    zoneName = estate;
  } else if (province) {
    zoneName = province;
  } else if (district) {
    zoneName = district;
  } else {
    zoneName = "พื้นที่อื่นๆ / ไม่ระบุโซน";
  }

  const zoneKey = zoneName.toLowerCase().replace(/\s+/g, "-");

  return {
    zoneKey,
    zoneName,
    province: province || "ไม่ระบุจังหวัด",
    district: district || estate || "-",
  };
}

export type ZoneGroup<T> = {
  zoneKey: string;
  zoneName: string;
  province: string;
  district: string;
  items: T[];
  vehicles: string[];
  staffList: string[];
  staff: string[];
};

/**
 * จัดกลุ่มรายการนัดหมายตามโซนพื้นที่ (Group by Zone)
 */
export function groupAppointmentsByZone<T extends {
  customer_address?: string | null;
  vehicle_plate?: string | null;
  staff_name?: string | null;
}>(
  items: T[],
  resolveAddress?: (item: T) => string | undefined,
): ZoneGroup<T>[] {
  const groupsMap = new Map<string, ZoneGroup<T>>();

  for (const item of items) {
    const addr = resolveAddress ? resolveAddress(item) : item.customer_address;
    const info = extractZoneInfo(addr);

    if (!groupsMap.has(info.zoneKey)) {
      groupsMap.set(info.zoneKey, {
        zoneKey: info.zoneKey,
        zoneName: info.zoneName,
        province: info.province,
        district: info.district,
        items: [],
        vehicles: [],
        staffList: [],
        staff: [],
      });
    }

    const group = groupsMap.get(info.zoneKey)!;
    group.items.push(item);

    // เก็บทะเบียนรถที่วิ่งในโซนนี้
    if (item.vehicle_plate) {
      const plates = item.vehicle_plate.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
      for (const p of plates) {
        if (!group.vehicles.includes(p)) group.vehicles.push(p);
      }
    }

    // เก็บช่างที่รับผิดชอบโซนนี้
    if (item.staff_name) {
      const staffs = item.staff_name.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
      for (const s of staffs) {
        if (!group.staffList.includes(s)) group.staffList.push(s);
        if (!group.staff.includes(s)) group.staff.push(s);
      }
    }
  }

  // เรียงลำดับ: กลุ่มที่มีงานเยอะที่สุดขึ้นก่อน ยกเว้น "พื้นที่อื่นๆ" ให้อยู่ล่างสุด
  return Array.from(groupsMap.values()).sort((a, b) => {
    const isOtherA = a.zoneName.includes("อื่นๆ");
    const isOtherB = b.zoneName.includes("อื่นๆ");
    if (isOtherA && !isOtherB) return 1;
    if (!isOtherA && isOtherB) return -1;
    return b.items.length - a.items.length;
  });
}

/**
 * สรุปข้อมูลว่ารถแต่ละคัน (ทะเบียน) วิ่งในโซนไหนบ้าง
 */
export function getVehicleZoneSummary<T extends {
  customer_address?: string | null;
  vehicle_plate?: string | null;
}>(items: T[]): Map<string, Array<{ zoneName: string; count: number }>> {
  const map = new Map<string, Map<string, number>>();

  for (const item of items) {
    if (!item.vehicle_plate) continue;
    const info = extractZoneInfo(item.customer_address);
    const plates = item.vehicle_plate.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);

    for (const plate of plates) {
      if (!map.has(plate)) {
        map.set(plate, new Map());
      }
      const zoneCounts = map.get(plate)!;
      zoneCounts.set(info.zoneName, (zoneCounts.get(info.zoneName) ?? 0) + 1);
    }
  }

  const result = new Map<string, Array<{ zoneName: string; count: number }>>();
  for (const [plate, zones] of map.entries()) {
    result.set(
      plate,
      Array.from(zones.entries())
        .map(([zoneName, count]) => ({ zoneName, count }))
        .sort((a, b) => b.count - a.count),
    );
  }

  return result;
}
