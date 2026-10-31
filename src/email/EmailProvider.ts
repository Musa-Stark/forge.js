export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
}

/** Anything that can deliver an e-mail. Implement it to use SES, SendGrid, SMTP... */
export interface EmailProvider {
  send(email: OutgoingEmail): Promise<void>;
}
