import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-black/80",
  outline: "border border-black/15 bg-white text-foreground hover:bg-black/[0.04]",
  secondary: "bg-muted text-foreground hover:bg-black/[0.08]",
  ghost: "text-foreground hover:bg-black/[0.05]",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  link: "h-auto px-0 underline underline-offset-4 decoration-black/30 hover:decoration-black",
} as const;

const sizes = { sm: "h-9 px-3 text-sm", default: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]" } as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

/** DS button: rounded-lg, tracking-tight, black primary, colour transitions 300ms. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "default", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium tracking-tight transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        variants[variant],
        variant !== "link" && sizes[size],
        className,
      )}
      {...props}
    />
  );
});

/** Trailing arrow that nudges +4px on hover (DS motion token). */
export function Nudge({ children }: { children: React.ReactNode }) {
  return <span className="transition-transform duration-300 group-hover:translate-x-1">{children}</span>;
}
