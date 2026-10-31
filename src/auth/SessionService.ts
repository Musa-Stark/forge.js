import type { Request } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { ErrorCode, UnauthorizedError } from "../errors/index.js";
import { REFRESH_TOKEN_MODEL } from "../data/internalModels.js";
import type { DataSource, Doc } from "../data/Repository.js";
import { safeEqual, sha256, type TokenService } from "../security/TokenService.js";
import { newObjectId } from "../utils/ids.js";
import type { Logger } from "../utils/Logger.js";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  userId: string;
  accessToken: string;
  /** Present only when the refresh token was rotated. */
  refreshToken?: string;
}

/**
 * Server-side sessions built on refresh tokens.
 *
 * - Every login starts a *family* of tokens. Each refresh rotates the token:
 *   the old one is marked as used and a new one is issued.
 * - Presenting an already-rotated token after the grace period means it was
 *   stolen (or replayed): the whole family is revoked.
 * - Tokens are stored as SHA-256 hashes and compared in constant time.
 */
export class SessionService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly tokens: TokenService,
    private readonly data: DataSource,
    private readonly logger: Logger,
  ) {}

  private get repo() {
    return this.data.repository(REFRESH_TOKEN_MODEL);
  }

  async start(userId: string, req?: Request): Promise<SessionTokens> {
    const familyId = newObjectId();
    const refreshToken = await this.issueRefreshToken(userId, familyId, req);
    return { accessToken: this.tokens.signAccess(userId, this.config.auth.accessTokenAge), refreshToken };
  }

  async refresh(rawToken: string | undefined, req?: Request): Promise<RefreshResult> {
    const claims = this.tokens.verifyRefresh(rawToken);
    const record = await this.repo.findById(claims.jti, { withSecrets: ["tokenHash"] });

    if (
      !record ||
      typeof record.tokenHash !== "string" ||
      !safeEqual(record.tokenHash, sha256(rawToken as string)) ||
      record.familyId !== claims.fam ||
      String(record.owner) !== claims.sub
    ) {
      throw new UnauthorizedError({ message: "The refresh token is not recognised.", code: ErrorCode.REFRESH_TOKEN_NOT_FOUND });
    }

    const now = Date.now();
    if (record.revokedAt) {
      throw new UnauthorizedError({ message: "This session has been closed.", code: ErrorCode.REFRESH_TOKEN_REVOKED });
    }
    if (record.rotatedAt) {
      const sinceRotation = now - new Date(record.rotatedAt).getTime();
      if (sinceRotation <= this.config.auth.refreshReuseGracePeriod.toMs()) {
        // Two tabs refreshed at the same moment: ask the client to retry with the newest token.
        throw new UnauthorizedError({ message: "This refresh token was just replaced.", code: ErrorCode.REFRESH_TOKEN_ROTATED });
      }
      await this.revokeFamily(claims.fam);
      this.logger.warn("Refresh token reuse detected; the session family was revoked.", { userId: claims.sub });
      throw new UnauthorizedError({
        message: "This session is no longer valid. Please log in again.",
        code: ErrorCode.REFRESH_TOKEN_REUSED,
      });
    }
    if (new Date(record.expiresAt).getTime() <= now) {
      throw new UnauthorizedError({ message: "The refresh token has expired.", code: ErrorCode.REFRESH_TOKEN_EXPIRED });
    }

    if (this.config.auth.verifyAccessUser && this.userModel && this.data.has(this.userModel)) {
      const user = await this.data.repository(this.userModel).findById(claims.sub);
      if (!user) {
        await this.revokeFamily(claims.fam);
        throw new UnauthorizedError({ message: "The account no longer exists.", code: ErrorCode.REFRESH_USER_NOT_FOUND });
      }
    }

    const accessToken = this.tokens.signAccess(claims.sub, this.config.auth.accessTokenAge);
    const age = now - this.createdAt(record);
    const shouldRotate = this.config.auth.rotateRefreshToken && age >= this.config.auth.refreshTokenRotationInterval.toMs();

    if (!shouldRotate) {
      await this.repo.updateById(record._id, { lastUsedAt: new Date(now) });
      return { userId: claims.sub, accessToken };
    }

    const refreshToken = await this.issueRefreshToken(claims.sub, claims.fam, req);
    await this.repo.updateById(record._id, { rotatedAt: new Date(now), lastUsedAt: new Date(now) });
    return { userId: claims.sub, accessToken, refreshToken };
  }

  /** Closes the session a refresh token belongs to. Never throws: logging out twice is fine. */
  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const claims = this.tokens.verifyRefresh(rawToken);
      await this.revokeFamily(claims.fam);
    } catch {
      /* invalid or expired token: nothing left to revoke */
    }
  }

  /** Closes every session of a user (password change, account deletion). */
  async revokeAll(userId: string): Promise<void> {
    await this.repo.deleteMany({ owner: userId });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.repo.updateMany({ familyId }, { revokedAt: new Date() });
  }

  private get userModel(): string | undefined {
    return this.config.auth.mongooseConfig?.model ?? this.config.collections.find((c) => c.type === "auth")?.model;
  }

  private createdAt(record: Doc): number {
    return new Date((record.createdAt as string | Date | undefined) ?? Date.now()).getTime();
  }

  private async issueRefreshToken(userId: string, familyId: string, req?: Request): Promise<string> {
    const jti = newObjectId();
    const token = this.tokens.signRefresh({ sub: userId, jti, fam: familyId }, this.config.auth.refreshTokenAge);
    await this.repo.create({
      _id: jti,
      owner: userId,
      tokenHash: sha256(token),
      familyId,
      expiresAt: this.config.auth.refreshTokenAge.fromNow(),
      lastUsedAt: new Date(),
      userAgent: req?.get("user-agent")?.slice(0, 512),
      ip: req?.ip?.slice(0, 64),
    });
    return token;
  }
}
