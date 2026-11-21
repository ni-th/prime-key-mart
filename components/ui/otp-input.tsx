"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type OtpInputProps = {
  /** Form field name; the joined code is submitted under it. */
  name: string
  /** Number of digits (default 6). */
  length?: number
  /** id of the first box, so a <Label htmlFor> focuses it. */
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  /** "true" marks every box as invalid (red border). */
  invalid?: boolean
  className?: string
  /** Called on every change with the digits typed so far. */
  onChange?: (code: string) => void
  /** Called once all boxes are filled. */
  onComplete?: (code: string) => void
}

/**
 * One-time-code input rendered as separate digit boxes. Typing moves to the
 * next box, Backspace moves back, arrows navigate, and pasting (or password
 * manager autofill) a full code fills every box at once. The joined value is
 * submitted through a hidden input named `name`, so it works with plain forms
 * and server actions.
 */
function OtpInput({
  name,
  length = 6,
  id,
  autoFocus,
  disabled,
  invalid,
  className,
  onChange,
  onComplete,
}: OtpInputProps) {
  const [digits, setDigits] = React.useState<string[]>(() => Array(length).fill(""))
  const refs = React.useRef<(HTMLInputElement | null)[]>([])

  const focusBox = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  const commit = (next: string[]) => {
    setDigits(next)
    onChange?.(next.join(""))
  }

  // Fire onComplete only after React has committed the new digits to the DOM,
  // so the hidden <input name> already holds the full code if the caller
  // submits the form from onComplete. (Calling it inside the change handler
  // would submit the previous value - one digit short.)
  const onCompleteRef = React.useRef(onComplete)
  React.useEffect(() => {
    onCompleteRef.current = onComplete
  })
  const lastCompleted = React.useRef<string | null>(null)
  React.useEffect(() => {
    const code = digits.join("")
    if (code.length === length && digits.every(Boolean)) {
      if (lastCompleted.current !== code) {
        lastCompleted.current = code
        onCompleteRef.current?.(code)
      }
    } else {
      lastCompleted.current = null
    }
  }, [digits, length])

  /** Write `chars` starting at box `start` (handles paste/autofill of many digits). */
  const fillFrom = (start: number, chars: string) => {
    const clean = chars.replace(/\D/g, "")
    if (!clean) return
    const next = [...digits]
    let i = start
    for (const ch of clean) {
      if (i >= length) break
      next[i++] = ch
    }
    commit(next)
    focusBox(i >= length ? length - 1 : i)
  }

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "") {
      const next = [...digits]
      next[i] = ""
      commit(next)
      return
    }
    // Box already held a digit and the new one was typed next to it: keep the
    // newest character. Several characters at once means autofill/paste.
    const typed = value.replace(/\D/g, "")
    if (!typed) return
    if (typed.length === 2 && digits[i]) {
      fillFrom(i, typed.replace(digits[i], "") || typed.slice(-1))
    } else {
      fillFrom(i, typed)
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault()
      const next = [...digits]
      next[i - 1] = ""
      commit(next)
      focusBox(i - 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    // A full code pasted into any box fills from the first box.
    const text = e.clipboardData.getData("text").replace(/\D/g, "")
    fillFrom(text.length >= length ? 0 : i, text)
  }

  return (
    <div
      role="group"
      aria-label="Verification code"
      className={cn("flex items-center gap-2", className)}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={i === 0 ? id : undefined}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="\d*"
          // Lets password managers / iOS offer the whole code in the first box.
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? length : 2}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className="size-10 min-w-0 rounded-lg border border-input bg-transparent text-center text-lg font-medium tabular-nums transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 sm:size-11"
        />
      ))}
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  )
}

export { OtpInput }
