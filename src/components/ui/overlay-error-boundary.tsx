import * as React from "react";
import { toast } from "sonner";

/** Keeps a crashing form from leaving only the dark backdrop on screen. */
export class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; close: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Dialog render error", error);
    toast.error(`เปิดฟอร์มไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}`);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="space-y-3 py-2 text-sm">
        <p className="font-semibold text-destructive">เปิดฟอร์มไม่สำเร็จ</p>
        <p className="text-muted-foreground break-words">{this.state.error.message}</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border px-3 py-1.5" onClick={() => this.setState({ error: null })}>
            ลองใหม่
          </button>
          {this.props.close}
        </div>
      </div>
    );
  }
}
