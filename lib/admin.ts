import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { availableStockByProduct } from "@/lib/products";
import { clampPage } from "@/lib/list-params";

/** Rows per page on the admin Products and Users lists. */
export const ADMIN_PAGE_SIZE = 20;

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

export const PRODUCT_STATUS_FILTERS = ["published", "hidden", "featured"] as const;
export const PRODUCT_STOCK_FILTERS = ["in", "low", "out"] as const;
export const PRODUCT_SORTS = ["newest", "name", "price-asc", "price-desc", "stock-asc", "best-selling"] as const;

export type AdminProductFilters = {
  q?: string;
  /** Category slug. */
  category?: string;
  status?: (typeof PRODUCT_STATUS_FILTERS)[number];
  stock?: (typeof PRODUCT_STOCK_FILTERS)[number];
  sort?: (typeof PRODUCT_SORTS)[number];
};

/**
 * Products with live stock + sold counts. Text/category/status filters run in
 * the database; stock filters and stock/sales sorting need the computed counts
 * so they run afterwards (the catalog is small enough for that).
 */
export async function getAdminProducts(filters: AdminProductFilters = {}) {
  const { q, category, status, stock, sort = "newest" } = filters;
  const products = await prisma.product.findMany({
    where: {
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { platform: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(category && { category: { slug: category } }),
      ...(status === "published" && { published: true }),
      ...(status === "hidden" && { published: false }),
      ...(status === "featured" && { featured: true }),
    },
    orderBy:
      sort === "name"
        ? { name: "asc" }
        : sort === "price-asc"
          ? { priceCents: "asc" }
          : sort === "price-desc"
            ? { priceCents: "desc" }
            : { createdAt: "desc" },
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

  let rows = products.map((p) => ({
    ...p,
    stock: available.get(p.id) ?? 0,
    sold: soldMap.get(p.id) ?? 0,
  }));

  if (stock === "out") rows = rows.filter((p) => p.stock === 0);
  else if (stock === "low") rows = rows.filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD);
  else if (stock === "in") rows = rows.filter((p) => p.stock > 0);

  if (sort === "stock-asc") rows.sort((a, b) => a.stock - b.stock);
  else if (sort === "best-selling") rows.sort((a, b) => b.sold - a.sold);

  return rows;
}

export const ORDER_SORTS = ["newest", "oldest", "total-desc", "total-asc"] as const;
export const ORDERS_PAGE_SIZE = 25;

export type AdminOrderFilters = {
  /** Order number, customer email or product name. */
  q?: string;
  status?: string;
  from?: Date | null;
  /** Inclusive: orders placed on this day are included. */
  to?: Date | null;
  sort?: (typeof ORDER_SORTS)[number];
  page?: number;
};

/** Paginated, filtered order list for the admin Orders page. */
export async function searchAdminOrders(filters: AdminOrderFilters = {}) {
  const { q, status, from, to, sort = "newest", page = 1 } = filters;
  const toExclusive = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : null;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status: status as Prisma.OrderWhereInput["status"] }),
    ...((from || toExclusive) && {
      createdAt: { ...(from && { gte: from }), ...(toExclusive && { lt: toExclusive }) },
    }),
    ...(q && {
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
      ],
    }),
  };

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "total-desc"
        ? { totalCents: "desc" }
        : sort === "total-asc"
          ? { totalCents: "asc" }
          : { createdAt: "desc" };

  // Count first so an out-of-range ?page= lands on the last page, not empty.
  const total = await prisma.order.count({ where });
  const current = clampPage(page, total, ORDERS_PAGE_SIZE);
  const orders = await prisma.order.findMany({
    where,
    orderBy: [orderBy, { id: "desc" }],
    skip: (current - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    include: { items: { select: { quantity: true } } },
  });
  return { orders, total, page: current, pageSize: ORDERS_PAGE_SIZE };
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
  q = "",
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

  const needle = q.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(needle) ||
        (r.name ?? "").toLowerCase().includes(needle),
    );
  }

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
