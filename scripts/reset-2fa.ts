/**
 * Turn off two-factor for an admin who lost their authenticator app.
 * Needs direct database access, so it can't be triggered from the website.
 *
 *   npm run admin:reset-2fa -- admin@example.com
 *
 * Against production, run it with the production DATABASE_URL set. The admin
 * then signs in with their password and is sent to set up a new QR code.
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:reset-2fa -- <admin email>");
  process.exit(1);
}

async function main(target: string) {
  const prisma = new PrismaClient();
  try {
    const { count } = await prisma.user.updateMany({
      where: { email: target },
      data: { totpEnabled: false, totpSecret: null, totpLastStep: null },
    });
    if (count === 0) {
      console.error(`No user with email ${target}.`);
      process.exitCode = 1;
    } else {
      console.log(`Two-factor reset for ${target}. They'll set it up again on next admin sign-in.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main(email);
