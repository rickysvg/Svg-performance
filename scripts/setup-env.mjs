import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  console.log(".env already exists — leaving it alone.");
  process.exit(0);
}

const secret = randomBytes(32).toString("hex");
const contents = `DATABASE_URL="file:./dev.db"
AUTH_SECRET="${secret}"
APP_URL="http://localhost:3000"
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
`;

fs.writeFileSync(envPath, contents);
console.log("Created .env for local preview (SQLite).");
