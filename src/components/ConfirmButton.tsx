import { ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** ปุ่มที่ต้องยืนยันก่อนทำงาน (ใช้กับการลบข้อมูล) */
export function ConfirmButton({
  onConfirm,
  title = "ยืนยันการลบ?",
  description = "การลบนี้ไม่สามารถย้อนกลับได้",
  confirmText = "ยืนยันลบ",
  cancelText = "ยกเลิก",
  children,
  size = "sm",
  variant = "ghost",
  className,
}: {
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  children: ReactNode;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "ghost" | "outline" | "destructive" | "default" | "secondary" | "link";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onConfirm()}>{confirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
