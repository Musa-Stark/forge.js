/**
 * Fields whose VALUE is identical across every single email you send —
 * your brand/company info. These don't vary per recipient or per request,
 * so you set them once when your app starts, not on every send call.
 *
 * Present in all 45/45 templates.
 */
export type CommonEmailPlaceholders = {
  companyName: string;
  companyUrl: string;
  companyAddress: string;
  supportEmail: string;
};
