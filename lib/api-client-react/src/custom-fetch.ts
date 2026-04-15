export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Removes trailing slashes from a string without using regex.
 * This avoids potential ReDoS vulnerabilities with polynomial regex patterns.
 */
const trimTrailingSlashes = (str: string): string => {
  let end = str.length;
  while (end > 0 && str[end - 1] === "/") {
    end--;
  }
  return end === str.length ? str : str.slice(0, end);
};

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
// skipcq: JS-0067
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? trimTrailingSlashes(url) : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 */
// skipcq: JS-0067
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

// skipcq: JS-0067
export function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

// skipcq: JS-0067
export function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
// skipcq: JS-0067
export function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

// skipcq: JS-0067
export function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

// skipcq: JS-0067
export function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

// skipcq: JS-0067
export function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

// skipcq: JS-0067
export function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

// skipcq: JS-0067
export function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

// skipcq: JS-0067
const TEXT_MEDIA_TYPES = new Set([
  "application/xml",
  "text/xml",
  "application/x-www-form-urlencoded",
]);

// skipcq: JS-0067
const isTextMediaType = (mediaType: string | null): boolean => {
  if (!mediaType) return false;
  if (mediaType.startsWith("text/")) return true;
  if (mediaType.endsWith("+xml")) return true;
  return TEXT_MEDIA_TYPES.has(mediaType);
};

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
// skipcq: JS-0067
export function hasNoBody(response: Response, method: string): boolean {
  return method === "HEAD" ||
    NO_BODY_STATUS.has(response.status) ||
    response.headers.get("content-length") === "0" ||
    response.body === null;
}

(function() {
  // empty because this IIFE is used to isolate scope
})();

// skipcq: JS-0067
export function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

// skipcq: JS-0067
export function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

// skipcq: JS-0067
export function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

// skipcq: JS-0067, JS-R1005
export function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  const mapping = [
    [!!(title && detail), `${title} — ${detail}`],
    [!!detail, detail],
    [!!message, message],
    [!!title, title]
  ];
  const body = mapping.find(([cond]) => cond)?.[1] || "";

  return body ? `${prefix}: ${body}` : prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

// skipcq: JS-0067
const stripBom = (text: string): string => {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

// skipcq: JS-0067
export async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

// skipcq: JS-0067, JS-R1005
export async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  const mediaType = getMediaType(response.headers);
  const isBlobFallback = Boolean(mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType));

  const handlers: Array<[() => boolean, () => Promise<unknown>]> = [
    [() => hasNoBody(response, method), async () => null],
    [() => isBlobFallback, async () => typeof response.blob === "function" ? response.blob() : response.text()],
    [() => true, async () => {
      const raw = await response.text();
      const normalized = stripBom(raw);
      const trimmed = normalized.trim();
      if (trimmed === "") {
        return null;
      }
      if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
        try {
          return JSON.parse(normalized);
        } catch {
          return raw;
        }
      }
      return raw;
    }]
  ];

  for (const [predicate, handler] of handlers) {
    if (predicate()) {
      return handler();
    }
  }
  return null;
}

// skipcq: JS-0067
export function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

// skipcq: JS-R1005
const parseSuccessBody = async (
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> => {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }
  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  const handlers: Record<"json" | "text" | "blob", () => Promise<unknown>> = {
    json: () => parseJsonBody(response, requestInfo),

    text: async () => {
      const text = await response.text();
      return text === "" ? null : text;
    },

    blob: async () => {
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead."
        );
      }
      return response.blob();
    },
  };

  return handlers[effectiveType]();
};

// skipcq: JS-0067
const setContentTypeHeader = (headers: Headers, initBody: BodyInit | null | undefined): void => {
  if (typeof initBody !== "string") return;
  if (headers.has("content-type")) return;
  if (!looksLikeJson(initBody)) return;
  headers.set("content-type", "application/json");
};

// skipcq: JS-0067
const setAcceptHeader = (headers: Headers, responseType: string): void => {
  if (responseType !== "json") return;
  if (headers.has("accept")) return;
  headers.set("accept", DEFAULT_JSON_ACCEPT);
};

// skipcq: JS-0067
const setJsonHeaders = (headers: Headers, initBody: BodyInit | null | undefined, responseType: string): void => {
  setContentTypeHeader(headers, initBody);
  setAcceptHeader(headers, responseType);
};

// skipcq: JS-0067
const setAuthHeaders = async (headers: Headers): Promise<void> => {
  if (!_authTokenGetter || headers.has("authorization")) {
    return;
  }
  const token = await _authTokenGetter();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
};

// skipcq: JS-0067
const checkBodyMethod = (method: string, body: BodyInit | null | undefined): void => {
  if (body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }
};

// skipcq: JS-0067
export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const absoluteInput = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(absoluteInput, init.method);
  checkBodyMethod(method, init.body);

  const headers = mergeHeaders(isRequest(absoluteInput) ? absoluteInput.headers : undefined, headersInit);
  setJsonHeaders(headers, init.body, responseType);
  await setAuthHeaders(headers);

  const requestInfo = { method, url: resolveUrl(absoluteInput) };
  const response = await fetch(absoluteInput, { ...init, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}
