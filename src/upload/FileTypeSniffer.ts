/** Detects a file's real type from its first bytes, so a spoofed `Content-Type` cannot sneak past. */
export class FileTypeSniffer {
  sniff(buffer: Buffer): string | undefined {
    const b = buffer;
    if (b.length < 12) return undefined;

    if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (b.toString("ascii", 0, 3) === "GIF") return "image/gif";
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    if (b.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
    if (b.toString("ascii", 4, 8) === "ftyp") {
      return b.toString("ascii", 8, 12).startsWith("qt") ? "video/quicktime" : "video/mp4";
    }
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "application/zip";
    return undefined;
  }
}
