import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "appearance-none flex min-h-[88px] w-full rounded-[11px] border border-border/70 bg-[hsl(var(--surface-panel)/1)] px-3 py-2 text-base text-foreground caret-[hsl(var(--foreground))] shadow-none transition-colors placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none focus-visible:border-ring focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
