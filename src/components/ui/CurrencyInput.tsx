import { useEffect, useState, forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Input } from "./Input";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Nilai dalam Rupiah, tersimpan tanpa titik (mis. 1000000) */
  value: number | null | undefined;
  /** Callback saat nilai berubah (dalam Rupiah tanpa titik) */
  onChangeValue: (value: number) => void;
}

function formatDisplay(value: number | null | undefined): string {
  if (!value || Number.isNaN(value)) return "";
  try {
    return Math.round(value).toLocaleString("id-ID");
  } catch {
    return String(value);
  }
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChangeValue, className = "", ...rest }, ref) => {
    const [display, setDisplay] = useState<string>(formatDisplay(value));

    useEffect(() => {
      setDisplay(formatDisplay(value));
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value ?? "";
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setDisplay("");
        onChangeValue(0);
        return;
      }
      const num = parseInt(digits, 10);
      setDisplay(formatDisplay(num));
      onChangeValue(num);
    }

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        className={className}
        value={display}
        onChange={handleChange}
        {...rest}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

