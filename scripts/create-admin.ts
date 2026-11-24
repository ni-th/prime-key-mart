/**
 * Create the first admin (or promote an existing account) on any database,
 * production included. Admins can't sign up through the website, and the
 * seed is for local development only (it adds sample products and keys).
 *
 *   npm run admin:create -- admin@example.com
 *
 * - Account exists (e.g. you registered on the live site): it becomes an
 *   admin. Its password is NOT changed.
 * - No account: you're asked for a password (typed hidden, twice), and the
 *   admin account is created with the email already verified.
 *
 * Against production, run it with the production DATABASE_URL set. On first
 * visit to /admin the admin sets up an authenticator app (2FA).
 * More admins can then be added from Admin -> Users.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:create -- <email>");
  process.exit(1);
}

/** Read a line without echoing it (for passwords). */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let prompted = false;
    out._writeToOutput = (s: string) => {
      // Show the question once; hide everything typed after it.
      if (!prompted) {
        out.output.write(s);
        prompted = true;
      } else if (s.includes("\n")) out.output.write("\n");
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(target: string) {
  const prisma = new PrismaClient();
  try {
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? "").hostname;
      } catch {
        return "(unknown)";
      }
    })();
    console.log(`Database: ${host}`);

    const existing = await prisma.user.findUnique({ where: { email: target } });
    if (existing) {
      if (existing.role === "ADMIN") {
        console.log(`${target} is already an admin. Nothing changed.`);
        return;
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
      console.log(`${target} is now an admin (password unchanged).`);
      return;
    }

    const password = await askHidden(`Password for new admin ${target} (8+ characters): `);
    if (password.length < 8 || password.length > 200) {
      console.error("The password must be 8 to 200 characters. Nothing was created.");
      process.exitCode = 1;
      return;
    }
    const again = await askHidden("Type it again: ");
    if (again !== password) {
      console.error("The passwords don't match. Nothing was created.");
      process.exitCode = 1;
      return;
    }

    await prisma.user.create({
      data: {
        email: target,
        name: "Admin",
        firstName: "Admin",
        lastName: "",
        role: "ADMIN",
        emailVerifiedAt: new Date(),
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Admin ${target} created. Sign in at /admin and set up your authenticator app.`);
  } finally {
    await prisma.$disconnect();
  }
}

main(email).catch((err) => {
  console.error(err);
  process.exit(1);
});
