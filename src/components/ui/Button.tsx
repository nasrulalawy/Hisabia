import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50";
    const variants = {
      primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
      secondary: "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]",
      outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]",
      ghost: "hover:bg-[var(--muted)]",
    };
    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
