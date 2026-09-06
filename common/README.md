# Email placeholder architecture

Every template's placeholders fall into three tiers. This determines who's
responsible for providing each value — you set some up once, the framework
computes some automatically, and the rest is genuine per-send business data
nothing but your app code could know.

```
common/
├── static-config.type.ts   CommonEmailPlaceholders type
├── static-config.ts        defineEmailConfig() helper
├── auto-fields.type.ts     AutoDerivedEmailFields type
└── auto-fields.ts          getAutoDerivedFields(req) + individual getters

types/    45 files, one per email — each composed from the two common types above
emails/   45 files, one per email — unchanged, still destructure the full placeholder list
```

## Tier 1 — Static config (`common/static-config.ts`)

`companyName`, `companyUrl`, `companyAddress`, `supportEmail`.

These appear in **45/45** templates and have the exact same value on every
single send, for every user, forever (until you rebrand). Define this once:

```ts
import { defineEmailConfig } from "./common/static-config.js";

export const emailConfig = defineEmailConfig({
  companyName: "Stark Industries",
  companyUrl: "https://starkindustries.com",
  companyAddress: "10880 Malibu Point, Malibu, CA",
  supportEmail: "support@starkindustries.com",
});
```

## Tier 2 — Auto-derived (`common/auto-fields.ts`)

`currentYear`, `ipAddress`, `deviceName`, `location`.

These change per request, but the framework can figure them out itself —
no developer input needed:

| Field | How it's derived |
|---|---|
| `currentYear` | `new Date().getFullYear()` |
| `ipAddress` | `x-forwarded-for` header, falling back to `req.ip` / socket |
| `deviceName` | parsed from the `user-agent` header |
| `location` | best-effort IP geolocation (stubbed — wire up `geoip-lite` or a hosted API, see comments in the file) |

```ts
import { getAutoDerivedFields } from "./common/auto-fields.js";

const auto = await getAutoDerivedFields(req); // { currentYear, ipAddress, deviceName, location }
```

`currentYear` is used in every template's footer. `ipAddress`/`deviceName`/`location`
are only used by the security-flavored templates: `login-alert`, `new-device-login`,
`password-changed` (all three), plus `security-alert` (`location` only).

Three more templates (`login-alert`, `password-changed`, plus similar ones) also take
a `loginTime`/`changeDate`/`changeTime` field — these mean "right now" too, but the
placeholder name isn't consistent across templates, so they're not in
`AutoDerivedEmailFields`. Use the included `getFormattedNow()` helper and pass it under
whichever key that specific template expects:

```ts
loginAlertEmail({ ...emailConfig, ...auto, loginTime: getFormattedNow(), ... });
```

## Tier 3 — Developer-provided (per email call)

Everything else — `userName`, `userEmail`, `verificationUrl`, `orderNumber`,
`invoiceAmount`, and so on. This is real business data (who the recipient is,
what they ordered, what link to send them) that only your application logic
knows. Each email's own type (`types/<name>.type.ts`) still lists exactly
which of these it needs.

## Putting it together

```ts
import { emailConfig } from "./config/email.js";
import { getAutoDerivedFields } from "./common/auto-fields.js";
import welcomeEmail from "./emails/welcome.js";

app.post("/signup", async (req, res) => {
  const user = await createUser(req.body);

  const html = welcomeEmail({
    ...emailConfig,                          // Tier 1 — static
    ...(await getAutoDerivedFields(req)),    // Tier 2 — auto
    userName: user.name,                     // Tier 3 — per-call
    userEmail: user.email,
    unsubscribeUrl: buildUnsubscribeUrl(user.id),
    dashboardUrl: "https://starkindustries.com/dashboard",
  });

  await sendEmail(user.email, "Welcome!", html);
});
```

Every `types/*.type.ts` file already types this correctly — spreading Tier 1 + Tier 2
satisfies `CommonEmailPlaceholders` and (where relevant) the `Pick<AutoDerivedEmailFields, ...>`
portion of the intersection type automatically; TypeScript will only complain about
whatever Tier 3 fields you still owe it.
