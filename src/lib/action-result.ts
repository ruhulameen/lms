// Shape returned by admin server actions; `error` is safe to show to the user.
export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
