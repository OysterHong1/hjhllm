const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";

export function getBackendBaseUrl(): string {
  return (
    process.env.BACKEND_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_BACKEND_BASE_URL
  );
}

type ProxyBackendOptions = {
  path: string;
  search?: string;
  headers?: HeadersInit;
};

function responseHeaders(response: Response): Headers {
  const headers = new Headers();
  const passthrough = [
    "content-disposition",
    "content-length",
    "content-type",
    "set-cookie",
    "x-archive-failed-media-count",
    "x-archive-filename",
    "x-archive-media-count",
  ];

  for (const name of passthrough) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

export async function proxyBackend(
  request: Request,
  options: ProxyBackendOptions
): Promise<Response> {
  const targetUrl = new URL(options.path, getBackendBaseUrl());
  targetUrl.search = options.search ?? new URL(request.url).search;

  const headers = new Headers(options.headers);
  const contentType = request.headers.get("content-type");
  if (contentType && !headers.has("content-type")) {
    headers.set("content-type", contentType);
  }
  const authorization = request.headers.get("authorization");
  if (authorization && !headers.has("authorization")) {
    headers.set("authorization", authorization);
  }
  const cookie = request.headers.get("cookie");
  if (cookie && !headers.has("cookie")) {
    headers.set("cookie", cookie);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response),
  });
}
