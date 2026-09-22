import { promoteUserToRole } from "../src/lib/admin";

const email = process.argv[2];
const roleArg = process.argv[3] === "coach" ? "coach" : "admin";
if (!email) {
  console.error("Usage: npm run staff:promote -- you@example.com coach");
  process.exit(1);
}

promoteUserToRole(email, roleArg)
  .then((user) => {
    console.log(`Set ${user.email} to ${user.role}.`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
