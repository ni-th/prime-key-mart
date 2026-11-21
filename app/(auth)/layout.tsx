import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="Keysby home" className="mb-8">
        <Logo className="text-xl" markClassName="size-9" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <Link
        href="/"
        className="mt-8 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to store
      </Link>
    </div>
  );
}
