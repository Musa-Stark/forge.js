export interface TestResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Send without the cookie jar (e.g. to test a public route). */
  noCookies?: boolean;
  /** Pass `FormData` for multipart uploads. */
  form?: FormData;
}

/** A tiny `fetch` wrapper with a cookie jar, so session flows read like a browser's. */
export class TestClient {
  private readonly jar = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  get cookies(): Record<string, string> {
    return Object.fromEntries(this.jar);
  }

  setCookie(name: string, value: string): void {
    this.jar.set(name, value);
  }

  clearCookies(): void {
    this.jar.clear();
  }

  get<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, undefined, options);
  }
  post<T = any>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("POST", path, body, options);
  }
  put<T = any>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PUT", path, body, options);
  }
  patch<T = any>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PATCH", path, body, options);
  }
  delete<T = any>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("DELETE", path, body, options);
  }

  async request<T = any>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<TestResponse<T>> {
    const headers: Record<string, string> = { ...options.headers };
    if (!options.noCookies && this.jar.size > 0) {
      headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    }

    let payload: string | FormData | undefined;
    if (options.form) payload = options.form;
    else if (body !== undefined) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      headers["content-type"] ??= "application/json";
    }

    // Redirects are returned, not followed: tests assert on the 302 and its Location header.
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, redirect: "manual", ...(payload !== undefined ? { body: payload } : {}) });
    this.absorbCookies(res);

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      /* not JSON */
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }

  private absorbCookies(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const [pair = "", ...attrs] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /^\s*expires=/i.test(a) && new Date(a.split("=")[1] ?? "").getTime() < Date.now());
      if (!value || expired) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }
}
