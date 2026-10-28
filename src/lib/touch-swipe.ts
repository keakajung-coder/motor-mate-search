import type * as React from "react";

/**
 * หยุดไม่ให้ touchstart/touchmove จากกล่องรายการลอย (Popover/Select/Dropdown/cmdk)
 * หลุดไปถึงตัวล็อกหน้าจอของ Radix (react-remove-scroll) ที่ฟังอยู่บน document
 * แล้วสั่ง preventDefault ทำให้ iOS/iPadOS ปัดนิ้วเลื่อนรายการไม่ได้
 */
const stop = (e: React.TouchEvent) => e.stopPropagation();

export const swipeTouchStyle: React.CSSProperties = {
  touchAction: "pan-y",
  WebkitOverflowScrolling: "touch",
} as React.CSSProperties;

type TouchHandlers = {
  onTouchMoveCapture?: React.TouchEventHandler<any>;
  onTouchStartCapture?: React.TouchEventHandler<any>;
};

/** รวม handler เดิมของผู้เรียกเข้ากับตัวหยุดการกระจาย touch */
export function swipeUnlockHandlers(props: TouchHandlers) {
  return {
    onTouchMoveCapture: (e: React.TouchEvent<any>) => {
      props.onTouchMoveCapture?.(e);
      stop(e);
    },
    onTouchStartCapture: (e: React.TouchEvent<any>) => {
      props.onTouchStartCapture?.(e);
      stop(e);
    },
  };
}
