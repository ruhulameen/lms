import { db } from "@/lib/db";
import { openSecret } from "@/lib/secret-box";
import { resolveSettings, type SettingGroup, type Settings } from "@/lib/settings-schema";

// The settings the app is running on, kept in memory so code that cannot wait
// (a price formatter, a media link) reads them without a query. Loaded when
// the server starts (src/instrumentation.ts), replaced straight after a save,
// and re-read in the background when older than MAX_AGE_MS in case another
// process saved them. Kept on globalThis: Next builds server components and
// their HTML rendering as separate module graphs, and both must see one copy.

const MAX_AGE_MS = 30_000;

const store = globalThis as {
  __lmsSettings?: { values: Settings; loadedAt: number };
  __lmsSettingsLoading?: Promise<Settings>;
  __lmsCurrency?: string;
};

function keep(values: Settings) {
  store.__lmsSettings = { values, loadedAt: Date.now() };
  // Read by siteCurrency() in src/lib/format.ts.
  store.__lmsCurrency = values.payment.currency;
  return values;
}

// Defaults plus the server's .env values: what applies before the first load
// and when the database cannot be reached.
function fallback() {
  return resolveSettings({}, process.env, openSecret);
}

// Reads the table again. Calls made while one is running share it.
export function refreshSettings(): Promise<Settings> {
  const running = store.__lmsSettingsLoading;
  if (running) return running;
  const loading = db.setting
    .findMany({ select: { key: true, value: true } })
    .then((rows) => {
      const byGroup: Partial<Record<SettingGroup, unknown>> = {};
      for (const row of rows) byGroup[row.key as SettingGroup] = row.value;
      return keep(resolveSettings(byGroup, process.env, openSecret));
    })
    .finally(() => {
      store.__lmsSettingsLoading = undefined;
    });
  store.__lmsSettingsLoading = loading;
  return loading;
}

// Makes sure the settings were loaded once. Never throws: without a database
// (a build, a script) the defaults apply.
export async function ensureSettings(): Promise<Settings> {
  if (store.__lmsSettings) return getSettings();
  try {
    return await refreshSettings();
  } catch (error) {
    console.error("[settings] could not be loaded, using defaults:", error instanceof Error ? error.message : error);
    return keep(fallback());
  }
}

export function getSettings(): Settings {
  const current = store.__lmsSettings;
  if (!current) {
    // Not loaded yet (a script, or a request that beat the start-up load):
    // run on the defaults and read the table in the background.
    const values = keep(fallback());
    void refreshSettings().catch(() => {});
    return values;
  }
  if (Date.now() - current.loadedAt > MAX_AGE_MS) {
    // Stamp first so a burst of requests starts one refresh, not one each.
    current.loadedAt = Date.now();
    void refreshSettings().catch(() => {});
  }
  return current.values;
}
