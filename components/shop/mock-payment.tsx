"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";

export function MockPayment({
  orderNumber,
  token,
  totalCents,
  currency,
}: {
  orderNumber: string;
  token: string;
  totalCents: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"pay" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "pay" | "cancel") {
    setError(null);
    setPending(action);
    try {
      const res = await fetch("/api/checkout/mock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber, token, action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong.");
        setPending(null);
        return;
      }
      if (action === "pay") {
        router.push(
          `/checkout/success?order=${orderNumber}&t=${encodeURIComponent(token)}`,
        );
      } else {
        router.push(`/checkout/cancel?order=${orderNumber}`);
      }
    } catch {
      setError("Network error. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        className="w-full"
        size="lg"
        disabled={pending !== null}
        onClick={() => act("pay")}
      >
        {pending === "pay" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        Pay {formatMoney(totalCents, currency.toUpperCase())} (simulated)
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={pending !== null}
        onClick={() => act("cancel")}
      >
        Cancel payment
      </Button>
    </div>
  );
}
