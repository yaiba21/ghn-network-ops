import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-white border border-[var(--color-ghn-red)] text-[var(--color-ghn-red)] hover:bg-[var(--color-ghn-red)] hover:text-white",
        secondary:
          "bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-hover)]",
        ghost:
          "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
        danger:
          "bg-[var(--color-ghn-red)] text-white border border-[var(--color-ghn-red)] hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-3.5 text-sm",
        lg: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    icon?: ReactNode;
    iconRight?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, icon, iconRight, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(button({ variant, size }), className)}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  ),
);
Button.displayName = "Button";
