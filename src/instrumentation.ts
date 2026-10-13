// Runs once when the server starts, before the first request: loads the site
// settings into memory (src/lib/settings-store.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSettings } = await import("@/lib/settings-store");
    await ensureSettings();
  }
}
