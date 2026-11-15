import { compressImage, fileToDataUrl } from "./image-compress";
import { PROFILE_PHOTO_MAX_BYTES } from "./profile-policy";
export async function compressProfilePhoto(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("เลือกไฟล์ JPG, PNG หรือ WebP");
  for (const [maxSize, quality] of [[800, 0.85], [640, 0.75], [480, 0.65], [320, 0.5]]) {
    const result = await compressImage(file, { maxSize, quality });
    if (result.size <= PROFILE_PHOTO_MAX_BYTES) return result;
  }
  throw new Error("ย่อรูปไม่สำเร็จ กรุณาเลือกรูปอื่น");
}
export async function profilePhotoBase64(file: File) {
  const compressed = await compressProfilePhoto(file);
  return (await fileToDataUrl(compressed)).split(",")[1] ?? "";
}