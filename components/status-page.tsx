import { cn } from "@/lib/utils";

/**
 * Shared layout for 404 and error pages: a big status code, an icon, a short
 * explanation, then actions. No hooks or server-only imports, so both server
 * (not-found) and client (error) pages can use it.
 */
export function StatusPage({
  code,
  icon,
  title,
  children,
  className,
}: {
  code: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24", className)}>
      <div className="relative mb-6">
        <span
          aria-hidden
          className="bg-gradient-to-br from-primary/25 to-primary/5 bg-clip-text text-8xl font-bold tracking-tighter text-transparent tabular-nums sm:text-9xl"
        >
          {code}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
            {icon}
          </span>
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-3 w-full space-y-6 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
