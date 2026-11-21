import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddKeysForm } from "@/components/admin/add-keys-form";
import { DeleteKeyButton } from "@/components/admin/delete-key-button";

export const metadata: Metadata = { title: "License keys · Admin" };

const STATUS_VARIANT: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  AVAILABLE: "secondary",
  RESERVED: "outline",
  SOLD: "default",
};

export default async function ProductKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const keys = await prisma.licenseKey.findMany({
    where: { productId: id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      orderItem: {
        select: { order: { select: { orderNumber: true } } },
      },
    },
  });

  const counts = {
    available: keys.filter((k) => k.status === "AVAILABLE").length,
    reserved: keys.filter((k) => k.status === "RESERVED").length,
    sold: keys.filter((k) => k.status === "SOLD").length,
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/products/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to product
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Keys · {product.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {counts.available} available · {counts.reserved} reserved ·{" "}
          {counts.sold} sold
        </p>
      </div>

      <AddKeysForm productId={id} />

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Added</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No keys yet. Paste some above.
                </TableCell>
              </TableRow>
            )}
            {keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-mono text-xs">
                  {decryptSecret({
                    ciphertext: k.secretCiphertext,
                    iv: k.secretIv,
                    authTag: k.secretAuthTag,
                  })}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[k.status] ?? "outline"}>
                    {k.status.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {k.orderItem?.order ? (
                    <Link
                      href={`/admin/orders/${k.orderItem.order.orderNumber}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {k.orderItem.order.orderNumber}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {k.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {k.status !== "SOLD" && <DeleteKeyButton id={k.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
