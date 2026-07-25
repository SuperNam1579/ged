"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls, type Variants } from "motion/react";

interface OtpInputProps {
  /** Current code as a string (may be shorter than `length` while typing). */
  value: string;
  onChange: (value: string) => void;
  /** Fires once the code reaches full `length`. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  /**
   * Increment this to trigger a shake (e.g. on a rejected code). Using a counter
   * rather than a boolean lets the same error fire the animation more than once.
   */
  shakeSignal?: number;
}

// A digit box pops when it becomes filled — the string variant only changes on
// the empty→filled transition, so the keyframe runs exactly once per entry.
const boxVariants: Variants = {
  empty: { scale: 1 },
  filled: { scale: [1.18, 1] },
};

/**
 * Segmented numeric OTP input — one box per digit, with paste, backspace, and
 * arrow-key navigation. Controlled: the parent owns the code string, this only
 * renders it and reports edits. Shared by email verification and password reset.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  ariaLabel = "Verification code",
  shakeSignal = 0,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const controls = useAnimationControls();
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  // Run the shake whenever the parent bumps the signal (skip the initial 0).
  useEffect(() => {
    if (shakeSignal > 0) {
      controls.start({ x: [0, -9, 9, -7, 7, -4, 0], transition: { duration: 0.42 } });
    }
  }, [shakeSignal, controls]);

  const commit = (arr: string[], focusIndex: number) => {
    const next = arr.join("");
    inputsRef.current[Math.min(Math.max(focusIndex, 0), length - 1)]?.focus();
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    const arr = digits.slice();
    if (!cleaned) {
      arr[index] = "";
      commit(arr, index);
      return;
    }
    // Spread multi-char input (fast typing / mobile autofill) across boxes.
    let i = index;
    for (const ch of cleaned) {
      if (i >= length) break;
      arr[i] = ch;
      i++;
    }
    commit(arr, i);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const arr = digits.slice();
      if (arr[index]) {
        arr[index] = "";
        commit(arr, index);
      } else if (index > 0) {
        arr[index - 1] = "";
        commit(arr, index - 1);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const arr = Array.from({ length }, (_, i) => pasted[i] ?? "");
    commit(arr, pasted.length);
  };

  return (
    <motion.div
      className="flex justify-center gap-2"
      onPaste={handlePaste}
      role="group"
      aria-label={ariaLabel}
      animate={controls}
    >
      {digits.map((digit, i) => (
        <motion.input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1}`}
          variants={boxVariants}
          animate={digit ? "filled" : "empty"}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-60"
        />
      ))}
    </motion.div>
  );
}
