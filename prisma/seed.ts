import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptSecret, keyFingerprint } from "../lib/crypto";

// `prisma db seed` injects env vars, but allow `tsx prisma/seed.ts` too.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional if the vars are already in the environment
}

const prisma = new PrismaClient();

const categories = [
  { slug: "operating-systems", name: "Operating Systems", sortOrder: 1 },
  { slug: "office-productivity", name: "Office & Productivity", sortOrder: 2 },
  { slug: "antivirus-security", name: "Antivirus & Security", sortOrder: 3 },
  { slug: "servers", name: "Servers", sortOrder: 4 },
];

type SeedProduct = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  brand: string;
  platform: string;
  region: string;
  priceCents: number;
  categorySlug: string;
  featured?: boolean;
};

const products: SeedProduct[] = [
  {
    slug: "windows-11-pro",
    name: "Windows 11 Pro",
    shortDescription: "Lifetime license for a single PC. Digital delivery.",
    description:
      "Genuine Windows 11 Pro retail license. Includes BitLocker device encryption, Remote Desktop, Hyper-V and business-grade management. One-time activation tied to your Microsoft account or hardware. Delivered instantly as a 25-character product key with step-by-step activation instructions.",
    brand: "Microsoft",
    platform: "Windows",
    region: "Global",
    priceCents: 3999,
    categorySlug: "operating-systems",
    featured: true,
  },
  {
    slug: "windows-11-home",
    name: "Windows 11 Home",
    shortDescription: "Lifetime license for home users. Digital delivery.",
    description:
      "Genuine Windows 11 Home retail license for a single PC. Perfect for everyday computing, gaming and family use. Delivered instantly as a 25-character product key with activation instructions.",
    brand: "Microsoft",
    platform: "Windows",
    region: "Global",
    priceCents: 2999,
    categorySlug: "operating-systems",
  },
  {
    slug: "windows-10-pro",
    name: "Windows 10 Pro",
    shortDescription: "Lifetime license for a single PC. Digital delivery.",
    description:
      "Genuine Windows 10 Pro retail license. A stable choice for older hardware and business environments that are not ready for Windows 11. Delivered instantly with activation instructions.",
    brand: "Microsoft",
    platform: "Windows",
    region: "Global",
    priceCents: 2499,
    categorySlug: "operating-systems",
  },
  {
    slug: "office-2021-pro-plus",
    name: "Office 2021 Professional Plus",
    shortDescription: "One-time purchase. Word, Excel, PowerPoint, Outlook & more.",
    description:
      "Microsoft Office 2021 Professional Plus for one Windows PC. Includes Word, Excel, PowerPoint, Outlook, Access, Publisher and OneNote. No subscription - a permanent license with a one-time payment. Delivered instantly with a product key and download link.",
    brand: "Microsoft",
    platform: "Windows",
    region: "Global",
    priceCents: 6999,
    categorySlug: "office-productivity",
    featured: true,
  },
  {
    slug: "office-2019-home-business",
    name: "Office 2019 Home & Business",
    shortDescription: "One-time purchase for Windows or Mac.",
    description:
      "Microsoft Office 2019 Home & Business for one device. Includes Word, Excel, PowerPoint and Outlook. Permanent license, no subscription. Delivered instantly with a product key.",
    brand: "Microsoft",
    platform: "Windows / macOS",
    region: "Global",
    priceCents: 5499,
    categorySlug: "office-productivity",
  },
  {
    slug: "microsoft-365-personal-1yr",
    name: "Microsoft 365 Personal (1 Year)",
    shortDescription: "12-month subscription. Always-updated apps + 1 TB OneDrive.",
    description:
      "Microsoft 365 Personal 12-month subscription for one person. Always-up-to-date Word, Excel, PowerPoint and Outlook across PC, Mac, phone and tablet, plus 1 TB of OneDrive cloud storage. Delivered instantly as a redemption code.",
    brand: "Microsoft",
    platform: "Cross-platform",
    region: "Global",
    priceCents: 5999,
    categorySlug: "office-productivity",
    featured: true,
  },
  {
    slug: "windows-server-2022-standard",
    name: "Windows Server 2022 Standard",
    shortDescription: "16-core license. Ideal for physical or lightly virtualized servers.",
    description:
      "Windows Server 2022 Standard edition, 16-core base license. Suited to non-virtualized or lightly virtualized environments. Delivered instantly with a product key and activation guidance.",
    brand: "Microsoft",
    platform: "Windows Server",
    region: "Global",
    priceCents: 24999,
    categorySlug: "servers",
  },
  {
    slug: "norton-360-deluxe-1yr",
    name: "Norton 360 Deluxe (1 Year, 5 Devices)",
    shortDescription: "Antivirus, VPN, password manager & 50 GB cloud backup.",
    description:
      "Norton 360 Deluxe protects up to 5 devices for 12 months. Includes real-time threat protection, Secure VPN, a password manager, dark web monitoring and 50 GB of cloud backup. Delivered instantly as an activation code.",
    brand: "Norton",
    platform: "Cross-platform",
    region: "Global",
    priceCents: 3499,
    categorySlug: "antivirus-security",
  },
  {
    slug: "bitdefender-total-security-1yr",
    name: "Bitdefender Total Security (1 Year, 5 Devices)",
    shortDescription: "Cross-platform malware protection with minimal system impact.",
    description:
      "Bitdefender Total Security for up to 5 devices for 12 months. Multi-layer ransomware protection, network threat prevention, and privacy tools for Windows, macOS, Android and iOS. Delivered instantly as an activation code.",
    brand: "Bitdefender",
    platform: "Cross-platform",
    region: "Global",
    priceCents: 2999,
    categorySlug: "antivirus-security",
  },
];

const KEYS_PER_PRODUCT = 6;

function randomBlock(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function makeFakeKey(): string {
  return Array.from({ length: 5 }, () => randomBlock(5)).join("-");
}

async function main() {
  console.log("Seeding categories...");
  const categoryBySlug = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: c,
    });
    categoryBySlug.set(c.slug, row.id);
  }

  console.log("Seeding products and license keys...");
  for (const p of products) {
    const categoryId = categoryBySlug.get(p.categorySlug)!;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        brand: p.brand,
        platform: p.platform,
        region: p.region,
        priceCents: p.priceCents,
        categoryId,
        featured: p.featured ?? false,
        published: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        brand: p.brand,
        platform: p.platform,
        region: p.region,
        priceCents: p.priceCents,
        categoryId,
        featured: p.featured ?? false,
        published: true,
      },
    });

    const existingKeys = await prisma.licenseKey.count({
      where: { productId: product.id },
    });
    const toCreate = Math.max(0, KEYS_PER_PRODUCT - existingKeys);
    if (toCreate > 0) {
      const rows = Array.from({ length: toCreate }, () => {
        const plain = makeFakeKey();
        const enc = encryptSecret(plain);
        return {
          productId: product.id,
          secretCiphertext: enc.ciphertext,
          secretIv: enc.iv,
          secretAuthTag: enc.authTag,
          fingerprint: keyFingerprint(plain),
        };
      });
      await prisma.licenseKey.createMany({ data: rows, skipDuplicates: true });
    }
    console.log(`  ${p.slug}: ${existingKeys + toCreate} keys`);
  }

  console.log("Seeding users...");
  // Admin accounts are provisioned here only - there is no admin self-registration.
  const adminEmail = "nimantha.bt@gmail.com";
  const adminPassword = "Nimantha@123";
  const userPassword = "user12345";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", name: "Nimantha", passwordHash: await bcrypt.hash(adminPassword, 10) },
    create: {
      email: adminEmail,
      name: "Nimantha",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  // Drop the old demo admin if it exists from an earlier seed.
  await prisma.user.deleteMany({ where: { email: "admin@keymart.test" } });

  await prisma.user.upsert({
    where: { email: "user@keymart.test" },
    update: { name: "Test Customer" },
    create: {
      email: "user@keymart.test",
      name: "Test Customer",
      role: "USER",
      passwordHash: await bcrypt.hash(userPassword, 10),
    },
  });

  console.log("\nDone. Sign-in credentials:");
  console.log(`  ${adminEmail} / ${adminPassword}  (ADMIN)`);
  console.log(`  user@keymart.test / ${userPassword}   (customer)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
