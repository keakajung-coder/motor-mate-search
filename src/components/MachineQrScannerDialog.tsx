import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDirectory } from "@/lib/directory";
import {
  QrCode,
  Camera,
  Search,
  X,
  Upload,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  Wrench,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** สกัดหมายเลข SN จากข้อความที่สแกนได้จาก QR Code (รองรับทั้ง URL และข้อความ SN ตรง) */
function extractSnFromScan(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    // ถ้าเป็น URL เช่น https://domain.com/?history=SN-12345 หรือ ?sn=SN-12345
    if (text.startsWith("http://") || text.startsWith("https://")) {
      const url = new URL(text);
      const historyParam = url.searchParams.get("history") || url.searchParams.get("sn");
      if (historyParam) return historyParam.trim();
    }
  } catch {
    /* not a standard URL */
  }
  return text;
}

export function MachineQrScannerDialog({
  open,
  onOpenChange,
  onSelectMachine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMachine: (serialNumber: string) => void;
}) {
  const dir = useDirectory();
  const [activeTab, setActiveTab] = useState<"search" | "camera">("search");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [barcodeSupported, setBarcodeSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      setBarcodeSupported(true);
    }
  }, []);

  // Stop camera helper
  const stopCamera = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsScanning(false);
  };

  // Start camera
  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("เบราว์เซอร์ไม่รองรับการเปิดกล้อง");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Start BarcodeDetector scan interval if supported
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanTimerRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              const sn = extractSnFromScan(rawValue);
              if (sn) {
                stopCamera();
                toast.success(`สแกนพบเครื่อง S/N: ${sn}`);
                onSelectMachine(sn);
                onOpenChange(false);
              }
            }
          } catch {
            /* ignore detect frame error */
          }
        }, 350);
      }
    } catch (err) {
      console.error(err);
      setCameraError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง หรือใช้วิธีค้นหาด้วย S/N",
      );
      stopCamera();
    }
  };

  // When tab changes or dialog closes, manage camera
  useEffect(() => {
    if (open && activeTab === "camera") {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, activeTab]);

  // Handle photo file upload decode
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ("BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          const sn = extractSnFromScan(barcodes[0].rawValue);
          if (sn) {
            toast.success(`ตรวจพบ S/N: ${sn} จากรูปภาพ`);
            onSelectMachine(sn);
            onOpenChange(false);
            return;
          }
        }
        toast.error("ไม่พบ QR Code ในภาพ กรุณาลองใหม่อีกครั้ง");
      } catch {
        toast.error("อ่าน QR Code จากภาพไม่สำเร็จ");
      }
    } else {
      toast.info("เบราว์เซอร์นี้ไม่รองรับการถอดรหัสรูปอัตโนมัติ กรุณาพิมพ์ค้นหาด้วย S/N");
    }
  };

  // Get distinct zones/provinces from directory
  const availableZones = useMemo(() => {
    const set = new Set<string>();
    for (const m of dir.machines) {
      const addr = m.address || "";
      // Match province or words
      const parts = addr.split(/[,\s•]+/);
      for (const p of parts) {
        if (p.includes("จังหวัด") || p.includes("จ.") || p.length >= 4) {
          const clean = p.replace(/^(จังหวัด|จ\.)/, "").trim();
          if (clean.length >= 3) set.add(clean);
        }
      }
    }
    return Array.from(set).slice(0, 15);
  }, [dir.machines]);

  // Filtered machines
  const filteredMachines = useMemo(() => {
    const kw = query.trim().toLowerCase();
    const zoneKw = zoneFilter === "all" ? "" : zoneFilter.toLowerCase();

    return dir.machines
      .filter((m) => {
        const addr = (m.address || "").toLowerCase();
        if (zoneKw && !addr.includes(zoneKw)) return false;
        if (!kw) return true;
        const sn = m.serial.toLowerCase();
        const custSn = (m.customer_sn || "").toLowerCase();
        const custName = m.customer.toLowerCase();
        const custId = (m.cust_id || "").toLowerCase();
        const label = (m.label || "").toLowerCase();
        const seller = (m.seller || "").toLowerCase();
        return (
          sn.includes(kw) ||
          custSn.includes(kw) ||
          custName.includes(kw) ||
          custId.includes(kw) ||
          label.includes(kw) ||
          seller.includes(kw) ||
          addr.includes(kw)
        );
      })
      .slice(0, 40);
  }, [dir.machines, query, zoneFilter]);

  const handleSelect = (sn: string) => {
    stopCamera();
    onSelectMachine(sn);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[99999] w-[min(calc(100vw-1.5rem),680px)] max-w-[680px] p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                เปิดแฟ้มประวัติเครื่องจักร (Digital Passport)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                สแกน QR Code หน้าเครื่อง หรือพิมพ์ค้นหาตาม S/N, ชื่อลูกค้า, หรือโซนพื้นที่
              </DialogDescription>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant={activeTab === "search" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer"
              onClick={() => setActiveTab("search")}
            >
              <Search className="h-4 w-4" />
              ค้นหา S/N &amp; ลูกค้า
            </Button>
            <Button
              type="button"
              variant={activeTab === "camera" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer"
              onClick={() => setActiveTab("camera")}
            >
              <Camera className="h-4 w-4" />
              สแกน QR Code
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 dropdown-scroll">
          {activeTab === "camera" ? (
            <div className="space-y-4">
              <div className="relative mx-auto aspect-square max-w-[340px] overflow-hidden rounded-2xl border-2 border-primary/50 bg-black flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                {/* Scanning guide overlay */}
                <div className="pointer-events-none absolute inset-8 border-2 border-dashed border-primary rounded-xl animate-pulse flex items-center justify-center">
                  <div className="h-12 w-12 border-t-2 border-l-2 border-primary absolute top-0 left-0 rounded-tl-lg" />
                  <div className="h-12 w-12 border-t-2 border-r-2 border-primary absolute top-0 right-0 rounded-tr-lg" />
                  <div className="h-12 w-12 border-b-2 border-l-2 border-primary absolute bottom-0 left-0 rounded-bl-lg" />
                  <div className="h-12 w-12 border-b-2 border-r-2 border-primary absolute bottom-0 right-0 rounded-br-lg" />
                </div>

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white p-4 text-center text-xs">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <span>กำลังเปิดกล้อง...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 text-white p-4 text-center text-xs">
                    <AlertCircle className="h-8 w-8 text-rose-500" />
                    <span className="font-semibold">{cameraError}</span>
                  </div>
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  ส่องกล้องไปที่ QR Code บนป้ายเครื่องจักร หรือเลือกรูปถ่าย QR Code
                </p>

                <div className="flex justify-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer shadow-xs">
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    เลือกรูปถ่าย QR จากคลังภาพ
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="พิมพ์ค้นหา S/N, ชื่อลูกค้า, หรือสถานที่ติดตั้ง..."
                  className="pl-9 pr-8 h-11 text-sm bg-background shadow-xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Zone Filter Chips */}
              {availableZones.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 text-xs">
                  <span className="text-muted-foreground shrink-0 text-[11px] font-medium">โซน:</span>
                  <button
                    type="button"
                    onClick={() => setZoneFilter("all")}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors cursor-pointer",
                      zoneFilter === "all"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    ทั้งหมด
                  </button>
                  {availableZones.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoneFilter(z)}
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors cursor-pointer",
                        zoneFilter === z
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              )}

              {/* Matching Machines List */}
              <div className="rounded-xl border divide-y divide-border/50 max-h-[380px] overflow-y-auto dropdown-scroll bg-card">
                {filteredMachines.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    ไม่พบเครื่องจักรที่ตรงกับ &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredMachines.map((m) => (
                    <button
                      key={m.serial}
                      type="button"
                      onClick={() => handleSelect(m.serial)}
                      className="w-full p-3 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {m.serial}
                          </span>
                          {m.customer_sn && (
                            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              S/N ลูกค้า: {m.customer_sn}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-medium truncate">
                            {m.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building2 className="h-3 w-3 text-primary" />
                            {m.cust_id ? `[${m.cust_id}] ` : ""}
                            {m.customer}
                          </span>
                          {m.address && (
                            <span className="flex items-center gap-1 truncate max-w-[220px]">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {m.address}
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="shrink-0 text-xs gap-1 border-primary/30 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      >
                        ดูประวัติ &gt;
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
