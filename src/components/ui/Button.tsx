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
    "bg-[#58cc02] text-white font-bold",
    "shadow-[0_4px_0_#3f8f01]",
    "hover:bg-[#4ab001] hover:shadow-[0_3px_0_#3f8f01]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_#3f8f01]",
    "disabled:bg-[#afafaf] disabled:shadow-[0_4px_0_#888] disabled:cursor-not-allowed",
  ].join(" "),
  secondary: [
    "bg-white text-[#1cb0f6] font-bold border-2 border-[#e5e5e5]",
    "shadow-[0_4px_0_#e5e5e5]",
    "hover:border-[#1cb0f6] hover:shadow-[0_3px_0_#e5e5e5]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_#e5e5e5]",
  ].join(" "),
  outline: [
    "bg-transparent text-[#1cb0f6] font-bold border-2 border-[#e5e5e5]",
    "hover:border-[#1cb0f6]",
    "active:translate-y-[1px]",
  ].join(" "),
  ghost: "text-[#777777] font-bold hover:bg-[#f7f7f7] active:translate-y-[1px]",
  danger: [
    "bg-red-500 text-white font-bold",
    "shadow-[0_4px_0_#b91c1c]",
    "hover:bg-red-600 hover:shadow-[0_3px_0_#b91c1c]",
    "active:translate-y-[2px] active:shadow-[0_2px_0_#b91c1c]",
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
          "inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-duo-green focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed",
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
