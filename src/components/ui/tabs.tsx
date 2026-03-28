import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex min-h-[32px] items-center justify-center rounded-[8px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-panel)/0.96)] p-[3px] text-[12px] text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "desktop-focus-ring workbench-motion-button inline-flex items-center justify-center whitespace-nowrap rounded-[6px] border border-transparent px-3 py-1 text-[12px] font-medium disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-[0.5px] data-[state=active]:bg-[hsl(var(--surface-elevated))] data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgba(18,24,33,0.06)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus:outline-none focus-visible:outline-none focus-visible:ring-0",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
