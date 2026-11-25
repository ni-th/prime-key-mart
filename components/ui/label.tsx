"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Red asterisk for required fields. Screen readers get "required" from the input itself. */
function RequiredMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("-ml-1 text-destructive", className)}>
      *
    </span>
  )
}

function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & {
  /** Show a red * after the text. Also set `required` on the input. */
  required?: boolean
}) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && <RequiredMark />}
    </label>
  )
}

export { Label, RequiredMark }
