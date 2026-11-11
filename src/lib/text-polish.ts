export interface PolishTarget {
  value: string;
  isConnected: boolean;
}

/** Apply only to the same, unchanged field; never discard edits made while waiting. */
export async function applyTextPolish<T extends PolishTarget>(
  target: T,
  request: (text: string) => Promise<{ text: string }>,
  write: (target: T, text: string) => void,
): Promise<string | null> {
  const original = target.value;
  const result = await request(original);
  if (!result.text?.trim()) throw new Error("AI ไม่ได้ส่งข้อความกลับมา กรุณาลองอีกครั้ง");
  if (!target.isConnected || target.value !== original) return null;
  write(target, result.text);
  return original;
}