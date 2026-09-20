import { promoteUserToAdmin } from "../src/lib/admin";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run admin:promote -- you@example.com");
  process.exit(1);
}

promoteUserToAdmin(email)
  .then((user) => {
    console.log(`Promoted ${user.email} to admin.`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
