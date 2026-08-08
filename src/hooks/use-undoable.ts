import { useCallback, useRef, useState } from "react";

/** state ที่ย้อนกลับ (undo) / ไปต่อ (redo) ได้ */
export function useUndoable<T>(initial: T) {
  const [history, setHistory] = useState<T[]>([initial]);
  const [index, setIndex] = useState(0);
  const skip = useRef(false);

  const value = history[index];

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setHistory((h) => {
        const cur = h[index];
        const resolved = typeof next === "function" ? (next as (p: T) => T)(cur) : next;
        if (Object.is(resolved, cur)) return h;
        const trimmed = h.slice(0, index + 1);
        trimmed.push(resolved);
        // จำกัดประวัติไม่เกิน 50 ขั้น
        const limited = trimmed.slice(-50);
        setIndex(limited.length - 1);
        return limited;
      });
    },
    [index],
  );

  /** ตั้งค่าใหม่และล้างประวัติ (เช่น โหลดข้อมูลรายการใหม่) */
  const reset = useCallback((next: T) => {
    skip.current = true;
    setHistory([next]);
    setIndex(0);
  }, []);

  const undo = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const redo = useCallback(() => setIndex((i) => Math.min(history.length - 1, i + 1)), [history.length]);

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
}
