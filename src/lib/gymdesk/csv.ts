import { displayLabel, hashEmail, hashNameKey, hashPhone } from "@/lib/gymdesk/crypto";
import { mapGymdeskStatus, type StatusMapResult } from "@/lib/gymdesk/status";

export const GYMDESK_CSV_HEADERS = [
  "Member ID",
  "First Name",
  "Last Name",
  "Phone",
  "2nd Phone",
  "Email",
  "2nd Email",
  "Date of birth",
  "Age",
  "Address",
  "City",
  "State",
  "Country",
  "Zip code",
  "Gender",
  "Type",
  "Membership",
  "Sold By",
  "Contacts",
  "Status",
  "Source",
  "Joined",
  "Check-in code",
  "Last Visit",
  "Last Payment",
  "Last Login",
  "Notes",
  "Ranks",
] as const;

export const USED_HEADERS = [
  "Member ID",
  "First Name",
  "Last Name",
  "Phone",
  "2nd Phone",
  "Email",
  "2nd Email",
  "Membership",
  "Status",
] as const;

export type GymdeskCsvRow = {
  gymdeskId: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  email: string;
  email2: string;
  membership: string;
  statusRaw: string;
  mapped: StatusMapResult;
  displayLabel: string;
  emailHash: string;
  email2Hash: string;
  phoneHash: string;
  phone2Hash: string;
  nameKey: string;
};

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export function parseGymdeskCsv(text: string): { rows: GymdeskCsvRow[]; errors: string[] } {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: ["CSV is empty."] };
  }
  const headerCells = parseCsvLine(lines[0]!).map((cell) => cell.trim());
  const index = new Map(headerCells.map((name, i) => [name, i]));
  if (!index.has("Member ID")) {
    return { rows: [], errors: ["CSV is missing the Member ID column."] };
  }
  const col = (row: string[], name: (typeof USED_HEADERS)[number]) => {
    const i = index.get(name);
    return i == null ? "" : (row[i] ?? "").trim();
  };

  const rows: GymdeskCsvRow[] = [];
  const errors: string[] = [];
  for (let n = 1; n < lines.length; n += 1) {
    const cells = parseCsvLine(lines[n]!);
    const gymdeskId = col(cells, "Member ID");
    if (!gymdeskId) {
      errors.push(`Row ${n + 1} has no Member ID.`);
      continue;
    }
    const firstName = col(cells, "First Name");
    const lastName = col(cells, "Last Name");
    const phone = col(cells, "Phone");
    const phone2 = col(cells, "2nd Phone");
    const email = col(cells, "Email");
    const email2 = col(cells, "2nd Email");
    const membership = col(cells, "Membership");
    const statusRaw = col(cells, "Status");
    rows.push({
      gymdeskId,
      firstName,
      lastName,
      phone,
      phone2,
      email,
      email2,
      membership,
      statusRaw,
      mapped: mapGymdeskStatus(statusRaw),
      displayLabel: displayLabel(firstName, lastName),
      emailHash: hashEmail(email),
      email2Hash: hashEmail(email2),
      phoneHash: hashPhone(phone),
      phone2Hash: hashPhone(phone2),
      nameKey: hashNameKey(lastName, firstName),
    });
  }
  return { rows, errors };
}

export function hashesFromWebhook(input: {
  name?: string;
  email?: string;
  phone?: string;
}) {
  const name = (input.name ?? "").trim();
  const parts = name.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return {
    firstName,
    lastName,
    displayLabel: displayLabel(firstName, lastName),
    emailHash: hashEmail(input.email ?? ""),
    phoneHash: hashPhone(input.phone ?? ""),
    nameKey: hashNameKey(lastName, firstName),
  };
}
