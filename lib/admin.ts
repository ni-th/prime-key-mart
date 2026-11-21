import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { availableStockByProduct } from "@/lib/products";

export const LOW_STOCK_THRESHOLD = 3;

/**
 * The current session, only if it is an admin who signed in with their
 * authenticator code. Every admin page and server action goes through this,
 * so a password alone (or a session from before 2FA was set up) is never
 * enough to act as an admin.
 */
export async function getAdminSession() {
  const session = await auth();
  return session?.user?.role === "ADMIN" && session.user.mfa ? session : null;
}

export async function getAdminStats() {
  const [agg, statusCounts, keysSold, productCount] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "FULFILLED" },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.licenseKey.count({ where: { status: "SOLD" } }),
    prisma.product.count(),
  ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count]),
  );

  return {
    revenueCents: agg._sum.totalCents ?? 0,
    fulfilledOrders: agg._count,
    pendingOrders: byStatus.PENDING ?? 0,
    totalOrders: statusCounts.reduce((n, s) => n + s._count, 0),
    keysSold,
    productCount,
  };
}

export async function getAdminProducts() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
  const [available, sold] = await Promise.all([
    availableStockByProduct(products.map((p) => p.id)),
    prisma.licenseKey.groupBy({
      by: ["productId"],
      where: { status: "SOLD", productId: { in: products.map((p) => p.id) } },
      _count: { _all: true },
    }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.productId, s._count._all]));

  return products.map((p) => ({
    ...p,
    stock: available.get(p.id) ?? 0,
    sold: soldMap.get(p.id) ?? 0,
  }));
}

export async function getAdminOrders(status?: string) {
  return prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { select: { quantity: true } } },
  });
}

// --- Users ---------------------------------------------------------------------

export type UserFilter = "all" | "registered" | "guests" | "flagged";

export type UserListRow = {
  kind: "registered" | "guest";
  id: string | null;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | null;
  suspended: boolean;
  note: string | null;
  orderCount: number;
  spentCents: number;
  createdAt: Date;
};

export async function getUsersList(
  filter: UserFilter = "all",
): Promise<UserListRow[]> {
  const [users, guestGroups, blocked, spentByUser, ordersByUser, spentByGuest] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.order.groupBy({
        by: ["email"],
        where: { userId: null },
        _count: { _all: true },
        _min: { createdAt: true },
      }),
      prisma.blockedEmail.findMany(),
      prisma.order.groupBy({
        by: ["userId"],
        where: { status: "FULFILLED", userId: { not: null } },
        _sum: { totalCents: true },
      }),
      prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { not: null } },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["email"],
        where: { status: "FULFILLED", userId: null },
        _sum: { totalCents: true },
      }),
    ]);

  const blockedMap = new Map(blocked.map((b) => [b.email, b.note]));
  const userEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const spentUser = new Map(
    spentByUser.map((s) => [s.userId as string, s._sum.totalCents ?? 0]),
  );
  const countUser = new Map(
    ordersByUser.map((s) => [s.userId as string, s._count._all]),
  );
  const spentGuest = new Map(
    spentByGuest.map((s) => [s.email, s._sum.totalCents ?? 0]),
  );

  const registered: UserListRow[] = users.map((u) => ({
    kind: "registered",
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    suspended: u.suspended,
    note: u.suspensionNote,
    orderCount: countUser.get(u.id) ?? 0,
    spentCents: spentUser.get(u.id) ?? 0,
    createdAt: u.createdAt,
  }));

  const guests: UserListRow[] = guestGroups
    .filter((g) => !userEmails.has(g.email.toLowerCase()))
    .map((g) => ({
      kind: "guest",
      id: null,
      email: g.email,
      name: null,
      role: null,
      suspended: blockedMap.has(g.email),
      note: blockedMap.get(g.email) ?? null,
      orderCount: g._count._all,
      spentCents: spentGuest.get(g.email) ?? 0,
      createdAt: g._min.createdAt ?? new Date(0),
    }));

  let rows = [...registered, ...guests];
  if (filter === "registered") rows = rows.filter((r) => r.kind === "registered");
  else if (filter === "guests") rows = rows.filter((r) => r.kind === "guest");
  else if (filter === "flagged") rows = rows.filter((r) => r.suspended);

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows;
}

export async function getUserDetail(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { select: { quantity: true } } },
      },
    },
  });
}

export async function getGuestDetail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [orders, blocked, isRegistered] = await Promise.all([
    prisma.order.findMany({
      where: { email: normalized, userId: null },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { quantity: true } } },
    }),
    prisma.blockedEmail.findUnique({ where: { email: normalized } }),
    prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }),
  ]);
  if (orders.length === 0 && !blocked) return null;
  return { email: normalized, orders, blocked, registeredUserId: isRegistered?.id ?? null };
}
