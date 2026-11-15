export const PROFILE_PHOTO_MAX_BYTES = 500 * 1024;
export function validateProfilePhoto(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > PROFILE_PHOTO_MAX_BYTES) throw new Error("รูปโปรไฟล์ต้องไม่เกิน 500KB");
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("เลือกไฟล์ JPG, PNG หรือ WebP");
  return jpeg ? "image/jpeg" : png ? "image/png" : "image/webp";
}
export function requireSelectedProfile(profileId?: string) {
  if (!profileId) throw new Error("กรุณาเลือกผู้ใช้งานอีกครั้งก่อนเปลี่ยนรูป");
  return profileId;
}