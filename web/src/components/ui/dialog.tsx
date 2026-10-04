"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered modal (side="center") or right-hand sheet (side="right"). */
export function DialogContent({
  children,
  title,
  description,
  side = "center",
  className,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  side?: "center" | "right";
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col bg-white outline-none",
          side === "center"
            ? "left-1/2 top-1/2 max-h-[90vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-black/10 p-6"
            : "inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-black/10 p-6",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-xl font-semibold tracking-tighter">{title}</D.Title>
            {description && <D.Description className="mt-1 text-sm text-black/60">{description}</D.Description>}
          </div>
          <D.Close className="rounded-md p-1 text-black/50 transition-colors hover:bg-black/5 hover:text-black" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
