"use client";

import { cn } from "@/lib/utils/cn";
import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, ReactNode, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
  error?: string;
  hint?: string;
  /** Optional leading icon rendered inside the field (e.g. a mail glyph). */
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, labelClassName, error, hint, icon, id, type, ...props }, ref) => {
    // Password fields get a built-in show/hide toggle so users can check what
    // they typed before submitting — no per-page wiring needed.
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword ? (revealed ? "text" : "password") : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className={labelClassName ?? "block text-sm font-medium text-foreground mb-1.5"}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={resolvedType}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors bg-card text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              icon && "pl-10",
              isPassword && "pr-10",
              error
                ? "border-danger bg-danger/10 focus:ring-danger"
                : "border-input hover:border-muted-foreground",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {hint && !error && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
