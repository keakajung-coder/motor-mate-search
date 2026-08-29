import { useCallback, useEffect, useState } from "react";

const SOUND_KEY = "pref_sound";
const VIBRATE_KEY = "pref_vibrate";

function read(key: string) {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(key) !== "0";
}

export function soundEnabled() {
  return read(SOUND_KEY);
}
export function vibrateEnabled() {
  return read(VIBRATE_KEY);
}

/** เสียงบี๊บสั้น 1000Hz 0.08 วินาที ด้วย Web Audio API */
export function beep(freq = 1000, seconds = 0.08) {
  if (typeof window === "undefined" || !soundEnabled()) return;
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function buzz(pattern: number | number[] = 120) {
  if (typeof navigator === "undefined" || !vibrateEnabled()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/** แจ้งเตือนเมื่อมีปัญหาใหม่เข้าคิวแอดมิน */
export function notifyAdminQueue() {
  beep();
  buzz([120, 60, 120]);
}

export function useAlertPrefs() {
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  useEffect(() => {
    setSound(read(SOUND_KEY));
    setVibrate(read(VIBRATE_KEY));
  }, []);

  const toggleSound = useCallback(() => {
    setSound((s) => {
      localStorage.setItem(SOUND_KEY, s ? "0" : "1");
      return !s;
    });
  }, []);
  const toggleVibrate = useCallback(() => {
    setVibrate((v) => {
      localStorage.setItem(VIBRATE_KEY, v ? "0" : "1");
      return !v;
    });
  }, []);

  return { sound, vibrate, toggleSound, toggleVibrate };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

/** สวิตช์เสียง / สั่น + ไฟสถานะเน็ต */
export function AlertToggles() {
  const { sound, vibrate, toggleSound, toggleVibrate } = useAlertPrefs();
  const online = useOnlineStatus();

  const cls = (on: boolean) =>
    "rounded-full border px-3 py-1 text-xs transition-colors " +
    (on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          toggleSound();
          if (!sound) beep();
        }}
        className={cls(sound)}
      >
        🔊 เสียง: {sound ? "เปิด" : "ปิด"}
      </button>
      <button
        type="button"
        onClick={() => {
          toggleVibrate();
          if (!vibrate) navigator.vibrate?.(120);
        }}
        className={cls(vibrate)}
      >
        📳 สั่น: {vibrate ? "เปิด" : "ปิด"}
      </button>
      <span className="text-xs text-muted-foreground">{online ? "🟢 ออนไลน์" : "🟠 ออฟไลน์"}</span>
    </div>
  );
}
