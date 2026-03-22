import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

const ACCESS_TOKEN_KEY = "api-key-organizer-access-token";
const REFRESH_TOKEN_KEY = "api-key-organizer-refresh-token";

type TokenState = {
  accessToken: string | null;
  refreshToken: string | null;
};

// One-time migration: clear leftover localStorage tokens for web users
if (!isTauriRuntime()) {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function readDesktopTokens(): Promise<TokenState> {
  const secureTokens = await invoke<TokenState>("read_auth_tokens");
  const normalized: TokenState = {
    accessToken: secureTokens.accessToken ?? null,
    refreshToken: secureTokens.refreshToken ?? null,
  };

  if (normalized.accessToken) {
    return normalized;
  }

  // Legacy migration: move localStorage tokens to OS keyring
  const legacyAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
  const legacyRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!legacyAccess || !legacyRefresh) {
    return normalized;
  }

  await invoke("save_auth_tokens", {
    accessToken: legacyAccess,
    refreshToken: legacyRefresh,
  });
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  return { accessToken: legacyAccess, refreshToken: legacyRefresh };
}

export async function hasStoredAccessToken() {
  if (!isTauriRuntime()) {
    // Web: httpOnly cookie is not accessible from JS — always try /me
    return true;
  }

  try {
    const tokens = await readDesktopTokens();
    return Boolean(tokens.accessToken);
  } catch {
    return false;
  }
}

export async function getStoredAccessToken() {
  if (!isTauriRuntime()) {
    // Web: cookie is sent automatically by the browser
    return null;
  }

  try {
    const tokens = await readDesktopTokens();
    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function getStoredRefreshToken() {
  if (!isTauriRuntime()) {
    // Web: cookie is sent automatically by the browser
    return null;
  }

  try {
    const tokens = await readDesktopTokens();
    return tokens.refreshToken;
  } catch {
    return null;
  }
}

export async function setStoredTokens(tokens: { accessToken: string; refreshToken: string }) {
  if (!isTauriRuntime()) {
    // Web: server sets httpOnly cookies — no client-side storage needed
    return;
  }

  await invoke("save_auth_tokens", tokens);
}

export async function clearStoredTokens() {
  if (!isTauriRuntime()) {
    // Web: server clears httpOnly cookies on logout
    return;
  }

  await invoke("clear_auth_tokens");
}
