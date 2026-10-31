import { Resend } from "resend";
import { ErrorCode, ServiceUnavailableError } from "../errors/index.js";
import type { EmailProvider, OutgoingEmail } from "./EmailProvider.js";

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail): Promise<void> {
    const { error } = await this.client.emails.send(email);
    if (error) {
      throw new ServiceUnavailableError({
        message: "The e-mail provider rejected the message.",
        code: ErrorCode.EMAIL_SEND_FAILED,
        hint: "Check the Resend API key, the verified sender domain and the recipient address.",
        cause: error,
      });
    }
  }
}
