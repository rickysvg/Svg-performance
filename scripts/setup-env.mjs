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
ADMIN_BOOTSTRAP_EMAIL=
OPENAI_API_KEY=
OPENAI_MODEL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_GYM=
STRIPE_PRICE_STANDALONE=
STRIPE_PRICE_CONDITIONING_GYM=
STRIPE_PRICE_CONDITIONING_NON=
STRIPE_PRICE_DEVELOPMENT_GYM=
STRIPE_PRICE_DEVELOPMENT_NON=
STRIPE_PRICE_ELITE_GYM=
STRIPE_PRICE_ELITE_NON=
STRIPE_PRICE_VIP=
STRIPE_PRICE_PLATINUM=
`;

fs.writeFileSync(envPath, contents);
console.log("Created .env for local preview (SQLite).");
