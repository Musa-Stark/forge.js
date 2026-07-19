# Email Template System

45 responsive, dark-mode-safe, Outlook-safe HTML email templates covering the full
`EmailTemplate` union. One shared design system, one visual language, 45 contexts.

```
output/
  welcome.html
  verify-email.html
  password-reset.html
  ... (45 files total, filename = template key)
```

## Design system

- **Layout**: table-based (not flex/grid) so it renders correctly in Outlook desktop,
  Gmail, Apple Mail, and other clients with limited CSS support.
- **Width**: 600px max, fluid down to mobile.
- **Type**: system font stack (`-apple-system, Segoe UI, Roboto, Helvetica, Arial`) —
  renders natively everywhere, no webfont loading required.
- **Card**: white card, 16px radius, 1px border, 4px accent bar on top that's color-coded
  per template category (auth = indigo, billing = green/red, commerce = purple,
  team/social = violet/amber, reports = blue, system = slate).
- **Icon badge**: every template opens with a 56px rounded icon badge (inline SVG,
  `currentColor` stroke) that visually signals what the email is about at a glance.
- **Components**: heading, body copy, optional highlight/warning box, optional
  key-value info table (invoices, orders, tickets…), optional OTP code block, optional
  CTA button, footer with unsubscribe/support links.
- **Hidden preheader**: every template includes the invisible preview text Gmail/Apple
  Mail show next to the subject line.
- Dark backgrounds/gradients are intentionally avoided in the card itself — email
  clients strip or mis-render CSS gradients and `prefers-color-scheme` inconsistently,
  so the templates use a light card with a strong color accent instead, which is safe
  and still reads as distinctive per category.

## Placeholders

All placeholders use `{{mustacheStyle}}` syntax — swap in your own templating engine
(Handlebars, a simple `.replace()`/regex pass, MJML data binding, etc).

### Global (present in every template)

| Placeholder | Description |
|---|---|
| `{{companyName}}` | Your product/company name (header + footer) |
| `{{companyUrl}}` | Linked from the header logo/wordmark |
| `{{companyAddress}}` | Footer physical address (recommended for deliverability/CAN-SPAM) |
| `{{userName}}` | Recipient's display name |
| `{{userEmail}}` | Recipient's email (footer "sent to" line) |
| `{{supportEmail}}` | Support contact shown in the footer |
| `{{unsubscribeUrl}}` | Footer unsubscribe link |
| `{{currentYear}}` | Footer copyright year |

### Per-template placeholders

Each template additionally uses placeholders specific to its context, for example:

- **Auth**: `{{verificationUrl}}`, `{{resetUrl}}`, `{{otpCode}}`, `{{magicLinkUrl}}`, `{{expiryMinutes}}`
- **Security**: `{{deviceName}}`, `{{location}}`, `{{ipAddress}}`, `{{loginTime}}`, `{{secureAccountUrl}}`
- **Team/org**: `{{inviterName}}`, `{{teamName}}`, `{{organizationName}}`, `{{memberRole}}`, `{{inviteUrl}}`
- **Billing**: `{{invoiceNumber}}`, `{{invoiceAmount}}`, `{{planName}}`, `{{paymentMethod}}`, `{{nextBillingDate}}`
- **Commerce**: `{{orderNumber}}`, `{{trackingNumber}}`, `{{carrierName}}`, `{{estimatedDelivery}}`
- **Reports**: `{{reportDate}}`/`{{reportPeriod}}`, `{{metricSignups}}`, `{{metricActiveUsers}}`, `{{metricRevenue}}`

Open any template file and search for `{{` to see the exact list it needs — every
placeholder is used exactly where it's named, so there's no hidden mapping to reverse-engineer.

## Usage (framework integration)

Minimal example with plain string replacement:

```ts
import fs from "fs";
import path from "path";
import type { EmailTemplate } from "./types";

type TemplateData = Record<string, string>;

function renderTemplate(name: EmailTemplate, data: TemplateData): string {
  const filePath = path.join(__dirname, "templates", `${name}.html`);
  let html = fs.readFileSync(filePath, "utf-8");

  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return html;
}

const html = renderTemplate("welcome", {
  companyName: "Stark Industries",
  companyUrl: "https://starkindustries.com",
  companyAddress: "10880 Malibu Point, Malibu, CA",
  userName: "Musa",
  userEmail: "musa@starkindustries.com",
  supportEmail: "support@starkindustries.com",
  unsubscribeUrl: "https://starkindustries.com/unsubscribe?u=abc123",
  currentYear: "2026",
  dashboardUrl: "https://starkindustries.com/dashboard",
});
```

For production, prefer a real templating engine (Handlebars/Mustache) over `.replaceAll`
so unresolved placeholders don't leak into sent emails — add a build-time or send-time
check that throws if any `{{...}}` pattern remains unresolved in the final HTML.

## Notes

- Every template is a **standalone file** — no shared includes/partials, so you can hand
  a single file to any transactional email provider (Postmark, SendGrid, Resend, SES) as-is.
- Accent colors and icons are set per template but are just inline hex values — safe to
  find-and-replace if you want to re-theme (e.g. swap the whole palette to match your brand).
- `preview.html` in this folder is a categorized index linking every template for quick
  visual QA while developing — it's a dev tool, not part of the shipped template set.
