import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "desktop-focus-ring appearance-none flex min-h-[88px] w-full rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-2 text-[13px] text-foreground caret-foreground shadow-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
