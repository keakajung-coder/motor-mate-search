import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, Sparkles, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { polishText } from "@/lib/ai-polish.functions";

type Field = HTMLInputElement | HTMLTextAreaElement;
const TEXT_TYPES = new Set(["text", "search", "", "email", "url", "tel"]);

function eligible(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled && !el.closest("[data-no-voice]");
  if (el instanceof HTMLInputElement) {
    return TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled && !el.closest("[data-no-voice]") && !el.closest("[cmdk-input-wrapper]") === false
      ? true
      : TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled && !el.closest("[data-no-voice]");
  }
  return false;
}

/** Write a value so React's controlled inputs see it, keeping the field freely editable. */
export function setFieldValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};

function getRecognition(): (new () => Recognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
}

export function VoiceInputLayer() {
  const [field, setField] = useState<Field | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [listening, setListening] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [lang, setLang] = useState<"th-TH" | "en-US">("th-TH");
  const recRef = useRef<Recognition | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const onFocus = (e: FocusEvent) => { if (eligible(e.target)) setField(e.target); };
    const onBlur = () => setTimeout(() => {
      if (busyRef.current) return;
      if (!eligible(document.activeElement)) setField(null);
    }, 150);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => { document.removeEventListener("focusin", onFocus); document.removeEventListener("focusout", onBlur); };
  }, []);

  useEffect(() => {
    if (!field) { setRect(null); return; }
    let raf = 0;
    const tick = () => {
      if (!field.isConnected) { setField(null); return; }
      const r = field.getBoundingClientRect();
      setRect((p) => (p && p.top === r.top && p.right === r.right && p.height === r.height ? p : r));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [field]);

  const stop = () => { recRef.current?.stop(); };

  const start = () => {
    if (!field) return;
    const Ctor = getRecognition();
    if (!Ctor) { toast.error("เบราว์เซอร์นี้ไม่รองรับการพูดเป็นข้อความ (แนะนำ Chrome หรือ Safari)"); return; }
    const target = field;
    const base = target.value;
    const sep = base && !/\s$/.test(base) ? " " : "";
    const rec = new Ctor();
    rec.lang = lang; rec.interimResults = true; rec.continuous = !/iPad|iPhone|iPod/.test(navigator.userAgent);
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      setFieldValue(target, base + sep + (finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("กรุณาอนุญาตการใช้ไมโครโฟน");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("รับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
    };
    rec.onend = () => { setListening(false); busyRef.current = false; recRef.current = null; target.focus(); };
    recRef.current = rec; busyRef.current = true;
    try { rec.start(); setListening(true); } catch { busyRef.current = false; toast.error("เปิดไมโครโฟนไม่สำเร็จ"); }
  };

  const polish = async () => {
    if (!field || polishing) return;
    const target = field;
    if (target.value.trim().length < 2) { toast.info("พิมพ์หรือพูดข้อความก่อน แล้วค่อยกดเกลา"); return; }
    busyRef.current = true; setPolishing(true);
    try {
      const res = await polishText({ data: { text: target.value } });
      setFieldValue(target, res.text);
      toast.success("เกลาข้อความแล้ว แก้ไขต่อได้ก่อนบันทึก");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกลาข้อความไม่สำเร็จ");
    } finally { setPolishing(false); busyRef.current = false; target.focus(); }
  };

  useEffect(() => () => recRef.current?.stop(), []);
  if (!field || !rect || rect.width < 60 || typeof document === "undefined") return null;
  const isArea = field instanceof HTMLTextAreaElement;
  const size = 32;
  const top = isArea ? rect.bottom - size - 4 : rect.top + (rect.height - size) / 2;
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const btn = "pointer-events-auto flex items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md";

  return createPortal(
    <div style={{ position: "fixed", top, left: rect.right - (isArea ? 2 * size + 10 : size + 4), zIndex: 2147483000 }} className="pointer-events-none flex items-center gap-1" data-voice-layer>
      {listening && (
        <span className="pointer-events-none absolute -top-7 right-0 whitespace-nowrap rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground animate-pulse">
          ● กำลังฟัง... ({lang === "th-TH" ? "ไทย" : "EN"})
        </span>
      )}
      {isArea && (
        <button type="button" title="AI เกลาข้อความ" aria-label="AI เกลาข้อความ" onPointerDown={keep} onMouseDown={keep} onClick={polish}
          style={{ width: size, height: size }} className={`${btn} text-primary`} disabled={polishing || listening}>
          {polishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
      )}
      <button type="button" title={listening ? "หยุดฟัง" : "พูดเพื่อพิมพ์ (กดค้างเพื่อสลับไทย/อังกฤษ)"} aria-label={listening ? "หยุดฟัง" : "พูดเพื่อพิมพ์"}
        onPointerDown={keep} onMouseDown={keep}
        onContextMenu={(e) => { e.preventDefault(); if (!listening) setLang((l) => (l === "th-TH" ? "en-US" : "th-TH")); }}
        onClick={listening ? stop : start}
        style={{ width: size, height: size }}
        className={`${btn} ${listening ? "bg-destructive text-destructive-foreground animate-pulse" : ""}`}>
        {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
      </button>
      {!listening && (
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => setLang((l) => (l === "th-TH" ? "en-US" : "th-TH"))}
          className={`${btn} h-5 px-1.5 text-[10px] font-bold`} aria-label="สลับภาษาเสียง">
          {lang === "th-TH" ? "TH" : "EN"}
        </button>
      )}
    </div>,
    document.body,
  );
}
