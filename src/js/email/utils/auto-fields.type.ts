/**
 * Fields the framework can figure out on its own at send time — from the
 * incoming request or the system clock — so the developer using the
 * framework never has to pass these in manually.
 *
 * Field -> where it's used (X/45 templates):
 *   currentYear  -> every template (footer copyright year)
 *   ipAddress    -> login-alert, new-device-login, password-changed
 *   deviceName   -> login-alert, new-device-login, password-changed
 *   location     -> login-alert, new-device-login, password-changed, security-alert
 */
export type AutoDerivedEmailFields = {
  currentYear: number;
  ipAddress: string;
  deviceName: string;
  location: string;
};
