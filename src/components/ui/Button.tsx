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
    "shadow-[0_4px_0_var(--primary-dark)]",
    "hover:brightness-105 hover:shadow-[0_3px_0_var(--primary-dark)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_var(--primary-dark)]",
    "disabled:bg-muted-foreground disabled:shadow-[0_4px_0_var(--border)] disabled:cursor-not-allowed",
  ].join(" "),
  secondary: [
    "bg-card text-accent font-bold border-2 border-border",
    "shadow-[0_4px_0_var(--border)]",
    "hover:border-accent hover:shadow-[0_3px_0_var(--border)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_var(--border)]",
  ].join(" "),
  outline: [
    "bg-transparent text-accent font-bold border-2 border-border",
    "hover:border-accent",
    "active:translate-y-[1px]",
  ].join(" "),
  ghost: "text-muted-foreground font-bold hover:bg-muted active:translate-y-[1px]",
  danger: [
    "bg-danger text-white font-bold",
    "shadow-[0_4px_0_color-mix(in_srgb,var(--danger)_70%,black)]",
    "hover:brightness-105 hover:shadow-[0_3px_0_color-mix(in_srgb,var(--danger)_70%,black)]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_color-mix(in_srgb,var(--danger)_70%,black)]",
  ].join(" "),
};

const sizes = {
  sm: "px-4 py-2 text-[13px] rounded-xl",
  md: "px-6 py-3 text-[15px] rounded-xl",
  lg: "px-8 py-4 text-[17px] rounded-xl",
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
          "inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed",
          "tracking-[0.053em]",
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
