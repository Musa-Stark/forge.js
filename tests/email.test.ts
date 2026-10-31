import { afterEach, describe, expect, it } from "vitest";
import { collection } from "../src/index.js";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { EmailService } from "../src/email/EmailService.js";
import { TemplateRenderer, templateConfigKey } from "../src/email/TemplateRenderer.js";
import { AutoFields } from "../src/email/utils/AutoFields.js";
import { FakeEmailProvider, type TestForge } from "../src/testing/index.js";
import { authForge, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

const common = { companyName: "Forge", companyUrl: "https://forge.test", companyAddress: "1 St", supportEmail: "h@forge.test", unsubscribeUrl: "https://forge.test/u", currentYear: 2026 };

describe("TemplateRenderer", () => {
  const renderer = new TemplateRenderer();

  it("knows all 45 built-in templates", () => {
    expect(renderer.names()).toHaveLength(45);
    expect(renderer.has("welcome")).toBe(true);
    expect(renderer.has("toString")).toBe(false);
    expect(renderer.has("__proto__")).toBe(false);
  });

  it.each(new TemplateRenderer().names())("renders '%s' to a full HTML document", async (name) => {
    const html = await renderer.render(name, { ...common, userName: "Ada", otpCode: "123456" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("maps template names to their config key", () => {
    expect(templateConfigKey("two-factor-code")).toBe("twoFactorCode");
    expect(templateConfigKey("welcome")).toBe("welcome");
    expect(templateConfigKey("api-key-created")).toBe("apiKeyCreated");
  });

  it("escapes HTML in every placeholder (user-controlled names cannot inject markup)", async () => {
    const html = await renderer.render("two-factor-code", {
      ...common, otpCode: "123456", expiryMinutes: 5, userEmail: "a@b.co",
      userName: `<img src=x onerror=alert(1)>"Bob"`,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;&quot;Bob&quot;");
  });

  it("neutralises javascript: and data: links in URL placeholders", async () => {
    const html = await renderer.render("two-factor-code", { ...common, otpCode: "1", companyUrl: "javascript:alert(document.cookie)", unsubscribeUrl: "data:text/html,<script>1</script>" });
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain("data:text/html");
  });

  it("keeps legitimate links and escapes quotes inside them", async () => {
    const html = await renderer.render("two-factor-code", { ...common, otpCode: "1", companyUrl: 'https://forge.test/a?b=1&c="2"' });
    expect(html).toContain("https://forge.test/a?b=1&amp;c=&quot;2&quot;");
  });

  it("escapes nested objects and arrays", async () => {
    const html = await renderer.render("invoice", { ...common, items: [{ name: "<b>x</b>", price: "1" }], userName: "u" });
    expect(html).not.toContain("<b>x</b>");
  });

  it("does not mutate the caller's data", async () => {
    const input = { ...common, otpCode: "1", userName: "<b>" };
    await renderer.render("two-factor-code", input);
    expect(input.userName).toBe("<b>");
  });

  it("raises a clear error for unknown templates", async () => {
    await expect(renderer.render("nope", {})).rejects.toMatchObject({ code: "EMAIL_TEMPLATE_ERROR", hint: expect.stringContaining("welcome") });
  });
});

describe("EmailService", () => {
  const make = (overrides: Record<string, unknown> = {}) => {
    const provider = new FakeEmailProvider();
    const config = new ForgeConfig({ ENV: "test", systemEmailSender: "Forge <noreply@forge.test>", ...overrides });
    return { provider, service: new EmailService(config, provider) };
  };

  const sendRaw = (service: EmailService, action: Record<string, unknown>) =>
    service.sendAction({ from: "system-email-sender", to: "to@example.com", type: "raw", rawBody: "<p>x</p>", subject: "Hi", ...action } as never, { req: { headers: {} } } as never);

  it("sends raw e-mails through the provider", async () => {
    const { provider, service } = make();
    await sendRaw(service, {});
    expect(provider.sent).toEqual([{ from: "Forge <noreply@forge.test>", to: "to@example.com", subject: "Hi", html: "<p>x</p>" }]);
  });

  it("resolves function recipients and subjects", async () => {
    const { provider, service } = make();
    await sendRaw(service, { to: async () => "fn@example.com", subject: () => "Dynamic" });
    expect(provider.sent[0]).toMatchObject({ to: "fn@example.com", subject: "Dynamic" });
  });

  it.each(["", "nope", "a@b", "a b@c.co", "a@b.co\nBcc: evil@x.co", "<a@b.co>"])("rejects the recipient %j", async (to) => {
    const { provider, service } = make();
    await expect(sendRaw(service, { to })).rejects.toMatchObject({ code: "INVALID_EMAIL_RECIPIENT", statusCode: 400 });
    expect(provider.sent).toHaveLength(0);
  });

  it("rejects bad senders and a missing system sender", async () => {
    await expect(sendRaw(make().service, { from: "just-an-address@x.co" })).rejects.toMatchObject({ code: "INVALID_EMAIL_SENDER" });
    await expect(sendRaw(make({ systemEmailSender: undefined }).service, {})).rejects.toMatchObject({ code: "INVALID_EMAIL_SENDER" });
    await expect(sendRaw(make().service, { from: "Evil <a@b.co>\r\nBcc: x@y.co" })).rejects.toMatchObject({ code: "INVALID_EMAIL_SENDER" });
  });

  it("strips line breaks from subjects (header injection) and requires one", async () => {
    const { provider, service } = make();
    await sendRaw(service, { subject: "Hello\r\nBcc: evil@x.co" });
    expect(provider.sent[0]!.subject).toBe("Hello Bcc: evil@x.co");
    await expect(sendRaw(service, { subject: "  " })).rejects.toMatchObject({ code: "EMAIL_ACTION_INVALID" });
  });

  it("requires rawBody for raw and a template name for templates", async () => {
    const { service } = make();
    await expect(sendRaw(service, { rawBody: "" })).rejects.toMatchObject({ code: "EMAIL_ACTION_INVALID" });
    await expect(sendRaw(service, { type: "template", template: undefined })).rejects.toMatchObject({ code: "EMAIL_ACTION_INVALID" });
  });

  it("renders templates, merging builtin config, resolved placeholders and derived fields", async () => {
    const { provider, service } = make({ builtinConfig: { email: { companyName: "Acme", companyUrl: "https://acme.test", companyAddress: "x", supportEmail: "s@acme.test", unsubscribeUrl: "https://acme.test/u" } } });
    await service.sendAction(
      {
        from: "system-email-sender", to: "to@example.com", type: "template", subject: "Code",
        template: { name: "two-factor-code", twoFactorCode: { otpCode: "654321", userName: (ctx: any) => ctx.user.name, expiryMinutes: 5, userEmail: "to@example.com", unsubscribeUrl: "https://acme.test/u" } },
      } as never,
      { req: { headers: {}, ip: "::1" }, user: { name: "<Ada>" } } as never,
    );
    const html = provider.sent[0]!.html;
    expect(html).toContain("654321");
    expect(html).toContain("Acme");
    expect(html).toContain("&lt;Ada&gt;");
    expect(html).toContain(String(new Date().getFullYear()));
  });

  it("sends templates for the OTP flow with the system sender", async () => {
    const { provider, service } = make();
    await service.sendTemplate({ to: "u@example.com", subject: "S", template: "two-factor-code", placeholders: { otpCode: "111222", userName: "U", expiryMinutes: 5, userEmail: "u@example.com" } });
    expect(provider.sent[0]).toMatchObject({ from: "Forge <noreply@forge.test>", to: "u@example.com" });
    expect(provider.lastCode("u@example.com")).toBe("111222");
  });

  it("propagates provider failures", async () => {
    const { provider, service } = make();
    provider.failNext = true;
    await expect(sendRaw(service, {})).rejects.toThrow("simulated provider failure");
  });
});

describe("AutoFields", () => {
  const fields = new AutoFields();
  const req = (over: Record<string, unknown> = {}) => ({ ip: "203.0.113.5", headers: {}, socket: { remoteAddress: "10.0.0.1" }, ...over }) as never;

  it("uses req.ip and ignores a spoofable X-Forwarded-For header", () => {
    expect(fields.clientIp(req({ headers: { "x-forwarded-for": "6.6.6.6" } }))).toBe("203.0.113.5");
  });

  it("falls back to the socket address and normalises IPv4-mapped IPv6", () => {
    expect(fields.clientIp(req({ ip: undefined }))).toBe("10.0.0.1");
    expect(fields.clientIp(req({ ip: "::ffff:192.168.1.9" }))).toBe("192.168.1.9");
    expect(fields.clientIp({ headers: {} } as never)).toBe("Unknown");
  });

  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17)", "iPhone"],
    ["Mozilla/5.0 (iPad; CPU OS 17)", "iPad"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel) Mobile Safari", "Android phone"],
    ["Mozilla/5.0 (Linux; Android 14; Tablet) Safari", "Android device"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "Mac"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64)", "Windows PC"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "Linux device"],
    ["PostmanRuntime/7.36", "Postman"],
    ["curl/8", "Unknown device"],
  ])("detects the device from %s", (ua, device) => expect(fields.deviceName(req({ headers: { "user-agent": ua } }))).toBe(device));

  it("handles a missing user agent", () => expect(fields.deviceName(req())).toBe("Unknown device"));

  it("labels local addresses and never geolocates public ones (no IP leaves the server)", () => {
    expect(fields.location("127.0.0.1")).toBe("Localhost");
    expect(fields.location("::1")).toBe("Localhost");
    expect(fields.location("192.168.1.5")).toBe("Local network");
    expect(fields.location("172.20.0.1")).toBe("Local network");
    expect(fields.location("fd12::1")).toBe("Local network");
    expect(fields.location("8.8.8.8")).toBe("Unknown location");
    expect(fields.location("Unknown")).toBe("Unknown location");
  });

  it("derives everything together", () => {
    expect(fields.derive(req())).toMatchObject({ ipAddress: "203.0.113.5", currentYear: new Date().getFullYear(), deviceName: "Unknown device" });
  });
});

describe("e-mail actions inside a request", () => {
  it("sends a templated welcome e-mail after sign-up through an action", async () => {
    t = await authForge({}, {
      collections: [collection({
        type: "crud", route: "events", model: "Event", schema: { title: { type: String } } as never,
        validations: {},
        routes: [{
          method: "post", path: "/", handler: "create", auth: "public", validation: false,
          actions: { after: [{ emailAction: { from: "system-email-sender", to: "ops@example.com", type: "template", subject: "Event", template: { name: "notification", notification: { userName: "Ops" } as never } } }] },
        }],
      })],
    });
    await signup(t.client);
    const res = await t.client.post("/events", {});
    expect(res.status).toBe(201);
    expect(t.email.lastTo("ops@example.com")?.html).toContain("<!DOCTYPE html>");
  });

  it("a failing e-mail action does not undo an already saved document", async () => {
    t = await authForge({}, {
      collections: [collection({
        type: "crud", route: "events", model: "Event", schema: { title: { type: String } } as never, validations: {},
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: false,
          actions: { after: [{ emailAction: { from: "system-email-sender", to: "not-an-email", type: "raw", rawBody: "x", subject: "S" } }] } }],
      })],
    });
    const res = await t.client.post("/events", {});
    expect(res.status).toBe(201);
    expect(t.data.repository("Event").dump()).toHaveLength(1);
  });
});
