import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

const ACCESS_TOKEN_KEY = "api-key-organizer-access-token";
const REFRESH_TOKEN_KEY = "api-key-organizer-refresh-token";

type TokenState = {
  accessToken: string | null;
  refreshToken: string | null;
};

function readLocalTokens(): TokenState {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function writeLocalTokens(tokens: TokenState) {
  if (tokens.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
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

  const legacyTokens = readLocalTokens();
  if (!legacyTokens.accessToken || !legacyTokens.refreshToken) {
    return normalized;
  }

  await invoke("save_auth_tokens", {
    accessToken: legacyTokens.accessToken,
    refreshToken: legacyTokens.refreshToken,
  });
  writeLocalTokens({ accessToken: null, refreshToken: null });
  return legacyTokens;
}

async function loadTokens() {
  if (!isTauriRuntime()) {
    return readLocalTokens();
  }

  try {
    return await readDesktopTokens();
  } catch {
    return readLocalTokens();
  }
}

export async function hasStoredAccessToken() {
  const tokens = await loadTokens();
  return Boolean(tokens.accessToken);
}

export async function getStoredAccessToken() {
  const tokens = await loadTokens();
  return tokens.accessToken;
}

export async function getStoredRefreshToken() {
  const tokens = await loadTokens();
  return tokens.refreshToken;
}

export async function setStoredTokens(tokens: { accessToken: string; refreshToken: string }) {
  const next: TokenState = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };

  if (isTauriRuntime()) {
    await invoke("save_auth_tokens", tokens);
    writeLocalTokens({ accessToken: null, refreshToken: null });
    return;
  }

  writeLocalTokens(next);
}

export async function clearStoredTokens() {
  if (isTauriRuntime()) {
    await invoke("clear_auth_tokens");
    writeLocalTokens({ accessToken: null, refreshToken: null });
    return;
  }

  writeLocalTokens({ accessToken: null, refreshToken: null });
}
