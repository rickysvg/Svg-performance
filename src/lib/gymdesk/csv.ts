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
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  if (text.startsWith("\uFEFF")) return text.slice(1);
  return text;
}

/**
 * RFC 4180 CSV records. Quoted fields may contain commas, "" escapes, and CR/LF.
 * Blank records (empty lines outside quotes) are skipped.
 */
export function parseCsvRecords(text: string): string[][] {
  const input = stripBom(text);
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawContent = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (!sawContent && row.every((cell) => cell.length === 0)) {
      row = [];
      return;
    }
    // Trailing CR from CRLF was already consumed with the LF path; lone CR ends a record.
    records.push(row);
    row = [];
    sawContent = false;
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
          sawContent = true;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        sawContent = true;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      sawContent = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      sawContent = true;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (ch === "\r") {
      pushField();
      if (input[i + 1] === "\n") i += 1;
      pushRow();
      continue;
    }
    field += ch;
    if (ch !== " " && ch !== "\t") sawContent = true;
  }

  if (inQuotes || field.length > 0 || row.length > 0 || sawContent) {
    pushField();
    pushRow();
  }

  return records;
}

export function parseGymdeskCsv(text: string): { rows: GymdeskCsvRow[]; errors: string[] } {
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return { rows: [], errors: ["CSV is empty."] };
  }
  const headerCells = (records[0] ?? []).map((cell) => cell.trim());
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
  for (let n = 1; n < records.length; n += 1) {
    const cells = records[n]!;
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
