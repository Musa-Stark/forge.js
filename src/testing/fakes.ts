import { newObjectId } from "../utils/ids.js";
import type { EmailProvider, OutgoingEmail } from "../email/EmailProvider.js";
import type { IncomingFile, StorageProvider } from "../upload/StorageProvider.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { UploadType } from "../types/upload.js";

/** Collects e-mails instead of sending them. */
export class FakeEmailProvider implements EmailProvider {
  readonly sent: OutgoingEmail[] = [];
  /** Make the next `send` fail, to test error handling. */
  failNext = false;

  async send(email: OutgoingEmail): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated provider failure");
    }
    this.sent.push(email);
  }

  lastTo(address: string): OutgoingEmail | undefined {
    return [...this.sent].reverse().find((e) => e.to.toLowerCase() === address.toLowerCase());
  }

  /** The `token` of the magic link in the last e-mail sent to `address`. */
  lastMagicToken(address: string): string {
    const html = this.lastTo(address)?.html ?? "";
    const match = /[?&amp;]token=([A-Za-z0-9_-]+)/.exec(html);
    if (!match?.[1]) throw new Error(`No magic-link e-mail found for ${address}`);
    return match[1];
  }

  /** The 6-digit code in the last e-mail sent to `address`. */
  lastCode(address: string): string {
    const html = this.lastTo(address)?.html ?? "";
    const match = /verification code is (\d{6})/.exec(html);
    if (!match?.[1]) throw new Error(`No code e-mail found for ${address}`);
    return match[1];
  }
}

/** Keeps "uploaded" files in a map. */
export class FakeStorage implements StorageProvider {
  readonly name = "cloudinary" as const;
  readonly files = new Map<string, StoreFile>();
  readonly removed: string[] = [];
  failNext = false;

  async upload(file: IncomingFile, { type }: { type: UploadType }): Promise<StoreFile> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated storage failure");
    }
    const key = `fake/${newObjectId()}`;
    const stored: StoreFile = {
      url: `https://files.example.test/${key}`,
      storageKey: key,
      bytes: file.size,
      format: file.mimetype.split("/")[1] ?? "bin",
      mimeType: file.mimetype,
      resourceType: type,
    };
    this.files.set(key, stored);
    return stored;
  }

  async remove(file: Pick<StoreFile, "storageKey">): Promise<void> {
    this.files.delete(file.storageKey);
    this.removed.push(file.storageKey);
  }
}

/** The smallest buffers that pass Forge's content sniffing. */
export const sample = {
  png: (): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]),
  jpeg: (): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]),
  pdf: (): Buffer => Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n"),
  /** Claims to be an image but is an HTML/script payload. */
  fakeImage: (): Buffer => Buffer.from("<html><script>alert(1)</script></html>"),
};
