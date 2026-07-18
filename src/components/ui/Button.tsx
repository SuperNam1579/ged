"use client";

import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants = {
  primary: [
    "bg-primary text-primary-foreground font-bold",
    "shadow-[0_4px_0_var(--primary-dark),0_0_0_0_rgba(30,144,232,0)]",
    "hover:brightness-110 hover:shadow-[0_4px_0_var(--primary-dark),0_8px_20px_-4px_rgba(30,144,232,0.55)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_var(--primary-dark)]",
    "disabled:bg-muted-foreground disabled:shadow-[0_4px_0_var(--border)] disabled:cursor-not-allowed disabled:hover:scale-100",
  ].join(" "),
  secondary: [
    "bg-card text-accent font-bold border-2 border-border",
    "shadow-[0_4px_0_var(--border)]",
    "hover:border-accent hover:bg-primary-light hover:shadow-[0_4px_0_var(--border),0_8px_20px_-6px_rgba(30,144,232,0.3)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_var(--border)]",
  ].join(" "),
  outline: [
    "bg-transparent text-accent font-bold border-2 border-border",
    "hover:border-accent hover:bg-primary-light",
  ].join(" "),
  ghost: "text-muted-foreground font-bold hover:bg-muted hover:text-foreground",
  danger: [
    "bg-danger text-white font-bold",
    "shadow-[0_4px_0_color-mix(in_srgb,var(--danger)_70%,black)]",
    "hover:brightness-110 hover:shadow-[0_4px_0_color-mix(in_srgb,var(--danger)_70%,black),0_8px_20px_-4px_rgba(229,72,77,0.5)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_color-mix(in_srgb,var(--danger)_70%,black)]",
  ].join(" "),
};

// Scale is size-driven, not variant-driven — a lg (often full-width) button
// growing by the same % as a small pill button moves far more pixels, which
// reads as "bigger animation" even though the percentage is identical.
const sizes = {
  sm: "px-4 py-2 text-[13px] rounded-full hover:scale-[1.08] active:scale-[0.94]",
  md: "px-6 py-3 text-[15px] rounded-full hover:scale-[1.05] active:scale-[0.96]",
  lg: "px-8 py-4 text-[17px] rounded-full hover:scale-[1.03] active:scale-[0.98]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-[transform,box-shadow,filter] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
