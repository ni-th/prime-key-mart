"use client";

import { useState, useTransition } from "react";
import { Loader2, Monitor, Send, Smartphone } from "lucide-react";
import { sendTestEmail, type SendTestResult } from "@/app/actions/emails";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Preview = { id: string; name: string; when: string; subject: string; html: string; text: string };

/** Pick an email, see it as the customer would (desktop/phone/plain text), send a test. */
export function EmailPreview({ emails }: { emails: Preview[] }) {
  const [activeId, setActiveId] = useState(emails[0]?.id);
  const [view, setView] = useState<"desktop" | "phone" | "text">("desktop");
  const [result, setResult] = useState<SendTestResult | null>(null);
  const [sending, startSend] = useTransition();
  const active = emails.find((e) => e.id === activeId) ?? emails[0];
  if (!active) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Emails">
        {emails.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setActiveId(e.id);
              setResult(null);
            }}
            className={cn(
              "shrink-0 rounded-lg border p-3 text-left text-sm transition-colors lg:shrink",
              e.id === active.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <div className="font-medium">{e.name}</div>
            <div className="hidden text-xs text-muted-foreground lg:block">{e.when}</div>
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-3">
        <Card className="gap-1 p-4">
          <div className="text-xs text-muted-foreground">Subject</div>
          <div className="font-medium">{active.subject}</div>
          <div className="text-xs text-muted-foreground">{active.when}</div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Preview size">
            {(
              [
                ["desktop", "Desktop", Monitor],
                ["phone", "Phone", Smartphone],
                ["text", "Plain text", null],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                {label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sending}
            onClick={() => startSend(async () => setResult(await sendTestEmail(active.id)))}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send me a test
          </Button>
        </div>

        {result && (
          <Alert variant={result.ok ? "default" : "destructive"}>
            <AlertDescription>{result.ok ? result.message : result.error}</AlertDescription>
          </Alert>
        )}

        {view === "text" ? (
          <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
            {active.text}
          </pre>
        ) : (
          <div className="flex justify-center rounded-xl border bg-muted/30 p-3">
            <iframe
              key={`${active.id}-${view}`}
              title={`${active.name} preview`}
              srcDoc={active.html}
              sandbox=""
              className={cn(
                "h-[720px] rounded-lg border bg-white",
                view === "phone" ? "w-[375px]" : "w-full",
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
