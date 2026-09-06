import type { CommonEmailPlaceholders } from "./static-config.type.js";

/**
 * Identity helper — exists purely so you get autocomplete + type-checking
 * when you define your config, and a single obvious place new devs look
 * for "where do I set the company name". Define this ONCE, wherever your
 * app bootstraps (e.g. `src/config/email.ts`), then spread it into every
 * email call.
 *
 * Example:
 *
 *   export const emailConfig = defineEmailConfig({
 *     companyName: "Stark Industries",
 *     companyUrl: "https://starkindustries.com",
 *     companyAddress: "10880 Malibu Point, Malibu, CA",
 *     supportEmail: "support@starkindustries.com",
 *   });
 *
 * Then, anywhere you send an email:
 *
 *   const html = welcomeEmail({
 *     ...emailConfig,
 *     ...(await getAutoDerivedFields(req)),
 *     userName: user.name,
 *     userEmail: user.email,
 *     unsubscribeUrl: buildUnsubscribeUrl(user.id),
 *     dashboardUrl: "https://starkindustries.com/dashboard",
 *   });
 */
export const defineEmailConfig = (
  config: CommonEmailPlaceholders
): CommonEmailPlaceholders => config;
