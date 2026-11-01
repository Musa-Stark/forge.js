import type { Response } from "express";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SuccessBody {
  success?: boolean;
  status?: number;
  message: string;
  data?: unknown;
  meta?: PageMeta;
  /** Extra top-level keys (e.g. tokens when `returnAccessToken` is enabled). */
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

/** The one place that decides what a successful response looks like. */
export class ResponseWriter {
  success(res: Response, body: SuccessBody): void {
    const { status: _status, success, message, data, meta, extra, ...fields } = body;
    res.status(body.status ?? 200).json({
      success: success ?? true,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(meta ? { meta } : {}),
      ...fields,
      ...extra,
    });
  }

  created(res: Response, body: SuccessBody): void {
    this.success(res, { ...body, status: 201 });
  }
}
