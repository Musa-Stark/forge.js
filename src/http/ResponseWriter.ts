import type { Response } from "express";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SuccessBody {
  status?: number;
  message: string;
  data?: unknown;
  meta?: PageMeta;
  /** Extra top-level keys (e.g. tokens when `returnAccessToken` is enabled). */
  extra?: Record<string, unknown>;
}

/** The one place that decides what a successful response looks like. */
export class ResponseWriter {
  success(res: Response, body: SuccessBody): void {
    res.status(body.status ?? 200).json({
      success: true,
      message: body.message,
      ...(body.data !== undefined ? { data: body.data } : {}),
      ...(body.meta ? { meta: body.meta } : {}),
      ...body.extra,
    });
  }

  created(res: Response, body: Omit<SuccessBody, "status">): void {
    this.success(res, { ...body, status: 201 });
  }
}
