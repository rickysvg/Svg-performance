import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/waitlist/route";
import {
  mailchimpMembersUrl,
  normalizeFirstName,
  normalizeWaitlistEmail,
  readMailchimpConfig,
  subscribeToAudience,
} from "@/lib/drop-waitlist";
import { resetWaitlistRateLimit } from "@/lib/drop-waitlist-rate";

const ENV = {
  MAILCHIMP_API_KEY: "test-key",
  MAILCHIMP_SERVER_PREFIX: "us21",
  MAILCHIMP_AUDIENCE_ID: "abc123",
};

function request(body: unknown, ip = "203.0.113.10") {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const valid = {
  email: "Athlete@Example.com",
  firstName: "Ricky",
  academyMember: "yes",
  consent: true,
};

afterEach(() => {
  resetWaitlistRateLimit();
  delete process.env.MAILCHIMP_API_KEY;
  delete process.env.MAILCHIMP_SERVER_PREFIX;
  delete process.env.MAILCHIMP_AUDIENCE_ID;
  delete process.env.MAILCHIMP_API_BASE;
});

describe("drop waitlist validation", () => {
  it("accepts an email and an optional first name", () => {
    expect(normalizeWaitlistEmail("  A@B.co ")).toBe("a@b.co");
    expect(normalizeWaitlistEmail("not-an-email")).toBeNull();
    expect(normalizeFirstName("")).toBe("");
    expect(normalizeFirstName("  Ana  Luz ")).toBe("Ana Luz");
    expect(normalizeFirstName("a<script>")).toBeNull();
  });

  it("stays unconfigured until the three Mailchimp names are set", () => {
    expect(readMailchimpConfig({})).toBeNull();
    expect(readMailchimpConfig({ ...ENV, MAILCHIMP_SERVER_PREFIX: "https://evil.test" })).toBeNull();
    expect(readMailchimpConfig(ENV)?.audienceId).toBe("abc123");
  });
});

describe("Mailchimp subscribe", () => {
  it("posts pending status and the academy tag", async () => {
    let seen: { url: string; body: Record<string, unknown>; auth: string } | null = null;
    const state = await subscribeToAudience({
      config: { apiKey: "test-key", serverPrefix: "us21", audienceId: "abc123" },
      email: "athlete@example.com",
      firstName: "Ricky",
      tag: "academy-member",
      fetchImpl: (async (url, init) => {
        seen = {
          url: String(url),
          body: JSON.parse(String(init?.body)),
          auth: String(new Headers(init?.headers).get("authorization")),
        };
        return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
      }) as typeof fetch,
    });
    expect(state).toBe("pending");
    expect(seen?.url).toBe(mailchimpMembersUrl({ apiKey: "x", serverPrefix: "us21", audienceId: "abc123" }));
    expect(seen?.body).toEqual({
      email_address: "athlete@example.com",
      status: "pending",
      tags: ["academy-member"],
      merge_fields: { FNAME: "Ricky" },
    });
    expect(seen?.auth.startsWith("Basic ")).toBe(true);
  });

  it("tags a non-member and skips an empty first name", async () => {
    let body: Record<string, unknown> | null = null;
    await subscribeToAudience({
      config: { apiKey: "test-key", serverPrefix: "us21", audienceId: "abc123" },
      email: "fan@example.com",
      firstName: "",
      tag: "non-member",
      fetchImpl: (async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });
    expect(body).toEqual({
      email_address: "fan@example.com",
      status: "pending",
      tags: ["non-member"],
    });
  });

  it("treats an existing member as already subscribed", async () => {
    const state = await subscribeToAudience({
      config: { apiKey: "test-key", serverPrefix: "us21", audienceId: "abc123" },
      email: "fan@example.com",
      firstName: "",
      tag: "non-member",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ title: "Member Exists", detail: "already a list member" }), {
          status: 400,
        })) as typeof fetch,
    });
    expect(state).toBe("exists");
  });
});

describe("waitlist route", () => {
  it("returns coming soon without calling Mailchimp when env is missing", async () => {
    delete process.env.MAILCHIMP_API_KEY;
    delete process.env.MAILCHIMP_SERVER_PREFIX;
    delete process.env.MAILCHIMP_AUDIENCE_ID;
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: "unconfigured" });
  });

  it("rejects a missing academy answer and a missing consent box", async () => {
    Object.assign(process.env, ENV);
    const missing = await POST(request({ ...valid, academyMember: "" }));
    expect(missing.status).toBe(400);
    expect((await missing.json()).message).toMatch(/Academy member/i);

    const consent = await POST(request({ ...valid, consent: false }));
    expect(consent.status).toBe(400);
    expect((await consent.json()).state).toBe("consent");
  });

  it("rate-limits repeated posts", async () => {
    Object.assign(process.env, ENV);
    process.env.MAILCHIMP_API_BASE = "http://127.0.0.1:9";
    for (let i = 0; i < 3; i += 1) {
      const response = await POST(request(valid, "203.0.113.20"));
      expect(response.status).toBe(502);
    }
    const blocked = await POST(request(valid, "203.0.113.20"));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).state).toBe("rate");
  });
});
