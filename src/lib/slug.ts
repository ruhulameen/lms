// Slug rules for posts (and later categories). Pure, so it is safe in any component.
export const SLUG_MAX_LENGTH = 100;

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Returns an error message, or null when the slug is acceptable.
export function validateSlug(slug: string) {
  if (!slug) return "Enter a slug.";
  if (slug.length > SLUG_MAX_LENGTH) return `Use at most ${SLUG_MAX_LENGTH} characters.`;
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers and single hyphens.";
  return null;
}

// First of `base`, `base-2`, `base-3`... that `exists` reports as free.
export async function nextFreeSlug(
  base: string,
  exists: (slug: string) => Promise<boolean> | boolean,
) {
  const root = slugify(base) || "untitled";
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (validateSlug(candidate)) continue;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not find a free slug.");
}
