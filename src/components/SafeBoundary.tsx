import { Component, type ReactNode } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; label?: string; onReset?: () => void };

class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[SafeBoundary]", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="font-medium">{this.props.label ?? "โหลดข้อมูลไม่สำเร็จ"}</p>
      <p className="text-sm text-muted-foreground">{this.state.error.message || "กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => { this.props.onReset?.(); this.setState({ error: null }); }}><RotateCw className="mr-2 h-4 w-4" />ลองอีกครั้ง</Button>
    </div>;
  }
}

/** Keeps a failing section (e.g. employee list) from blanking the whole screen. */
export function SafeBoundary(props: Props) {
  const { reset } = useQueryErrorResetBoundary();
  return <Boundary {...props} onReset={() => { reset(); props.onReset?.(); }} />;
}
