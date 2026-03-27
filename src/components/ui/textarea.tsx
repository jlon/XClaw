import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "appearance-none flex min-h-[88px] w-full rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-2 text-[13px] text-foreground caret-[hsl(var(--foreground))] shadow-none transition-colors duration-[var(--motion-fast)] ease-out placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:border-[hsl(var(--border-subtle))] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
