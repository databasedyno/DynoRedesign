import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { SD_ACCENT } from "./sdTheme";

/** Six digit boxes that behave like one field: type, backspace across boxes, paste a whole code. */
export default function CodeInput({ value, onChange, onComplete, autoFocus, disabled, testId = "sd-signin-code" }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  useEffect(() => {
    if (autoFocus) setTimeout(() => focusAt(0), 30);
  }, [autoFocus]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <Box role="group" aria-label="6-digit code" sx={{ display: "flex", gap: { xs: 0.8, sm: 1 }, justifyContent: "space-between" }} data-testid={`${testId}-group`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Box
          key={i}
          component="input"
          ref={(el: HTMLInputElement | null) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          disabled={disabled}
          value={digits[i] || ""}
          data-testid={i === 0 ? testId : `${testId}-${i + 1}`}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
          onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!pasted) return;
            set(pasted);
            focusAt(Math.min(5, pasted.length));
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return set(digits.slice(0, i) + digits.slice(i + 1));
            if (typed.length > 1) {
              const merged = (digits.slice(0, i) + typed).slice(0, 6);
              set(merged);
              return focusAt(merged.length);
            }
            const merged = (digits.slice(0, i) + typed + digits.slice(i + 1)).slice(0, 6);
            set(merged);
            if (i < 5) focusAt(i + 1);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              set(digits.slice(0, i - 1));
              focusAt(i - 1);
            } else if (e.key === "ArrowLeft" && i > 0) focusAt(i - 1);
            else if (e.key === "ArrowRight" && i < 5) focusAt(i + 1);
          }}
          sx={{
            width: { xs: 42, sm: 48 },
            height: { xs: 52, sm: 58 },
            textAlign: "center",
            fontSize: 24,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            borderRadius: 2.5,
            border: `1.5px solid ${digits[i] ? SD_ACCENT : "#D1D5DB"}`,
            backgroundColor: disabled ? "#F9FAFB" : "#fff",
            color: "#111827",
            outline: "none",
            transition: "border-color .12s, box-shadow .12s",
            "&:focus": { borderColor: SD_ACCENT, boxShadow: `0 0 0 3px ${SD_ACCENT}33` },
          }}
        />
      ))}
    </Box>
  );
}
