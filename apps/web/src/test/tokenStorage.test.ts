import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  hasStoredAccessToken,
  setStoredTokens,
} from "../platform/tokenStorage";

vi.mock("../platform/runtime", () => ({
  isTauriRuntime: () => false,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("tokenStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("web modunda tokenlari localStorage uzerinden yazar ve okur", async () => {
    await setStoredTokens({ accessToken: "access-1", refreshToken: "refresh-1" });

    await expect(getStoredAccessToken()).resolves.toBe("access-1");
    await expect(getStoredRefreshToken()).resolves.toBe("refresh-1");
    await expect(hasStoredAccessToken()).resolves.toBe(true);
  });

  it("clear islemi tokenlari temizler", async () => {
    await setStoredTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    await clearStoredTokens();

    await expect(getStoredAccessToken()).resolves.toBeNull();
    await expect(getStoredRefreshToken()).resolves.toBeNull();
    await expect(hasStoredAccessToken()).resolves.toBe(false);
  });
});
