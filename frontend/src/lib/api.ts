const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8002";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await parseJson(response);
    let message = response.statusText;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (Array.isArray(detail)) {
        message = detail
          .map((item) =>
            typeof item === "object" && item && "msg" in item
              ? String((item as { msg: string }).msg)
              : JSON.stringify(item)
          )
          .join("; ");
      } else if (typeof detail === "object" && detail) {
        message = "msg" in detail ? String((detail as { msg: string }).msg) : JSON.stringify(detail);
      } else if (detail) {
        message = String(detail);
      }
    }
    throw new ApiError(message || "Request failed", response.status);
  }

  return (await parseJson(response)) as T;
}
