export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  subscriptionPlan: "base" | "ai_lead_gen";
  impersonatedBy?: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

const STORAGE_KEY = "leadgen_auth_session";
let refreshPromise: Promise<AuthSession> | null = null;

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function writeStoredSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    if (onSessionExpired) {
      onSessionExpired();
    }
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

async function refreshSession(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        writeStoredSession(null);
        throw new Error("Session refresh failed");
      }

      const session = (await response.json()) as AuthSession;
      writeStoredSession(session);
      return session;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export const authStorage = {
  get: readStoredSession,
  set: writeStoredSession,
  clear: () => writeStoredSession(null),
};

async function request<T>(method: HttpMethod, path: string, body?: unknown, retry = true): Promise<T> {
  const session = readStoredSession();
  const headers = new Headers();

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry && session?.refreshToken) {
    await refreshSession(session.refreshToken);
    return request<T>(method, path, body, false);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data as T;
}

async function requestBlob(path: string, retry = true): Promise<Blob> {
  const session = readStoredSession();
  const headers = new Headers();

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
  });

  if (response.status === 401 && retry && session?.refreshToken) {
    await refreshSession(session.refreshToken);
    return requestBlob(path, false);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data));
  }

  return response.blob();
}

function extractErrorMessage(data: unknown) {
  if (typeof data === "object" && data !== null) {
    const candidate = data as {
      message?: unknown;
      issues?: { fieldErrors?: Record<string, string[] | undefined> };
    };

    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      if (candidate.message === "Validation failed") {
        const fieldErrors = candidate.issues?.fieldErrors ?? {};
        const firstFieldError = Object.values(fieldErrors).flat().find(Boolean);
        if (firstFieldError) return firstFieldError;
      }

      return candidate.message;
    }
  }

  return "Request failed";
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  download: (path: string) => requestBlob(path),
};

export async function login(email: string, password: string) {
  const session = await api.post<AuthSession>("/auth/login", { email, password });
  writeStoredSession(session);
  return session;
}

export async function register(input: { email: string; password: string; displayName: string; phoneNumber: string }) {
  const session = await api.post<AuthSession>("/auth/register", input);
  writeStoredSession(session);
  return session;
}

export async function logout() {
  const session = readStoredSession();
  if (session?.refreshToken) {
    await api.post("/auth/logout", { refreshToken: session.refreshToken }).catch(() => undefined);
  }
  writeStoredSession(null);
}
