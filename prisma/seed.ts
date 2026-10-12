import "dotenv/config";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { allPermissions } from "../src/lib/permissions";

// `student` and `instructor` are reserved names: panel routing depends on them.
const roles = [
  { name: "student", description: "Learner enrolled in courses" },
  { name: "instructor", description: "Creates and teaches courses" },
  { name: "admin", description: "Full access to the admin panel" },
];

// Keeps the permission table equal to the list in src/lib/permissions.ts.
async function seedPermissions() {
  for (const permission of allPermissions) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
  }
  const { count } = await db.permission.deleteMany({
    where: { key: { notIn: allPermissions.map((p) => p.key) } },
  });
  console.log(
    `Seeded ${allPermissions.length} permissions` +
      (count ? `, removed ${count} obsolete` : ""),
  );
}

// Self sign-up only creates students, so the first admin comes from here.
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipped admin user: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
    return;
  }

  if (!(await db.user.findUnique({ where: { email } }))) {
    await auth.api.signUpEmail({
      body: { name: process.env.SEED_ADMIN_NAME ?? "Admin", email, password },
    });
  }

  const admin = await db.user.update({
    where: { email },
    data: { emailVerified: true, role: { connect: { name: "admin" } } },
  });
  // Sign-up opens a session; the seed has no use for it.
  await db.session.deleteMany({ where: { userId: admin.id } });
  console.log(`Seeded admin user: ${email}`);
}

async function main() {
  for (const role of roles) {
    await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${roles.length} roles: ${roles.map((r) => r.name).join(", ")}`);

  await seedPermissions();
  await seedAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
