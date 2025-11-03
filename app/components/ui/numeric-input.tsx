import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumericInputProps = Omit<InputProps, "type" | "inputMode"> & {
  step?: number | "any";
};

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, step = "any", min = 0, onWheel, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      const element = inputRef.current;
      if (!element) return;
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
      };
      element.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        element.removeEventListener("wheel", handleWheel);
      };
    }, []);

    const setRefs = React.useCallback(
      (instance: HTMLInputElement | null) => {
        inputRef.current = instance;
        if (typeof forwardedRef === "function") {
          forwardedRef(instance);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = instance;
        }
      },
      [forwardedRef],
    );

    return (
      <Input
        ref={setRefs}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        onWheel={onWheel}
        className={cn("numeric-input", className)}
        {...props}
      />
    );
  },
);

NumericInput.displayName = "NumericInput";
