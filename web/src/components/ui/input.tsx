import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm tracking-tight outline-none transition-colors placeholder:text-black/40 focus:border-black focus:ring-1 focus:ring-black",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between text-sm font-medium tracking-tight">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-black/60">{hint}</span>}
    </div>
  );
}
