import type { Metadata } from "next";
import { EMAIL_SAMPLES } from "@/lib/email/samples";
import { EmailPreview } from "@/components/admin/email-preview";

export const metadata: Metadata = { title: "Emails · Admin" };

export default function AdminEmailsPage() {
  // Rendered on the server from the .hbs templates with sample data.
  const emails = EMAIL_SAMPLES.map((s) => {
    const e = s.render();
    return { id: s.id, name: s.name, when: s.when, subject: e.subject, html: e.html, text: e.text };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email the store sends, with sample data. Edit the templates in the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">emails/</code> folder (Handlebars{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.hbs</code> files).
        </p>
      </div>
      <EmailPreview emails={emails} />
    </div>
  );
}
