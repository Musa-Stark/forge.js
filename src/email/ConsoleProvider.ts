import type { Logger } from "../utils/Logger.js";
import type { EmailProvider, OutgoingEmail } from "./EmailProvider.js";

/** Development provider: prints the message instead of sending it (used when `isOffline` is true). */
export class ConsoleProvider implements EmailProvider {
  constructor(private readonly logger: Logger) {}

  async send(email: OutgoingEmail): Promise<void> {
    this.logger.info(`[offline e-mail] to=${email.to} subject="${email.subject}"`);
  }
}
