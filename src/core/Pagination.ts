import type { Request } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ErrorCode } from "../errors/index.js";
import type { PageMeta } from "../http/ResponseWriter.js";

export interface PageRequest {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

const SORTABLE_ALWAYS = ["_id", "createdAt", "updatedAt"];
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parses `?page=&limit=&sort=` safely (bounded size, whitelisted sort fields). */
export class Pagination {
  constructor(private readonly config: ForgeConfig) {}

  parse(req: Request, sortable: readonly string[]): PageRequest {
    const { defaultSize, maxSize } = this.config.pagination;
    const page = this.positiveInt(req.query.page, "page", 1);
    const limit = Math.min(this.positiveInt(req.query.limit, "limit", defaultSize), maxSize);
    return { page, limit, skip: (page - 1) * limit, sort: this.parseSort(req.query.sort, sortable) };
  }

  meta(request: PageRequest, total: number): PageMeta {
    return { page: request.page, limit: request.limit, total, pages: Math.max(1, Math.ceil(total / request.limit)) };
  }

  private positiveInt(raw: unknown, name: string, fallback: number): number {
    if (raw === undefined || raw === "") return fallback;
    // Digits only: rejects "2e3", "0x10", "1.5", "-1" and arrays/objects from `?limit[]=`.
    const value = typeof raw === "string" && /^\d{1,7}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
      throw new BadRequestError({ message: `'${name}' must be a positive integer.`, code: ErrorCode.INVALID_QUERY });
    }
    return value;
  }

  private parseSort(raw: unknown, sortable: readonly string[]): Record<string, 1 | -1> {
    if (raw === undefined || raw === "") return { createdAt: -1, _id: -1 };
    if (typeof raw !== "string") throw new BadRequestError({ message: "'sort' must be a string.", code: ErrorCode.INVALID_QUERY });

    const allowed = new Set([...SORTABLE_ALWAYS, ...sortable]);
    const sort: Record<string, 1 | -1> = {};
    for (const part of raw.split(",").slice(0, 5)) {
      const direction = part.startsWith("-") ? -1 : 1;
      const field = part.replace(/^[-+]/, "");
      if (!FIELD_NAME.test(field) || !allowed.has(field)) {
        throw new BadRequestError({
          message: `Cannot sort by '${field}'.`,
          code: ErrorCode.INVALID_QUERY,
          hint: `Sortable fields: ${[...allowed].join(", ")}.`,
        });
      }
      sort[field] = direction;
    }
    return sort;
  }
}
