import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";

type NumericInputProps = Omit<InputProps, "type" | "inputMode"> & {
  step?: number | "any";
};

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, step = "any", min = 0, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        className={className}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
