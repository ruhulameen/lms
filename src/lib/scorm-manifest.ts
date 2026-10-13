import { XMLParser } from "fast-xml-parser";
import { normalisePath } from "@/lib/scorm";

// Reading a SCORM package's imsmanifest.xml. Kept apart from src/lib/scorm.ts
// so the XML parser stays on the server (the player in the browser imports that file).

export type ScormManifest = {
  title: string;
  // The page that starts the course, relative to the package root.
  entry: string;
  // The pass mark the package asks the LMS to apply, when it names one.
  masteryScore: number | null;
  // Text the package wants handed back when it starts (adlcp:datafromlms).
  launchData: string | null;
};

export type ManifestResult = { ok: true; manifest: ScormManifest } | { ok: false; error: string };

const asArray = <T>(value: T | T[] | undefined | null): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

type Node = Record<string, unknown>;

// Every <item> under an organisation, depth first.
function flattenItems(node: Node | undefined): Node[] {
  return asArray(node?.item as Node | Node[] | undefined).flatMap((item) => [item, ...flattenItems(item)]);
}

// Reads imsmanifest.xml. Accepts SCORM 1.2 packages that start from one page
// (one launchable item), which is what authoring tools export.
export function parseScormManifest(xml: string): ManifestResult {
  let root: Node;
  try {
    // Namespace prefixes (adlcp:) are dropped so tags read the same whatever prefix a tool used.
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, processEntities: true }).parse(xml);
    root = parsed.manifest;
  } catch {
    return { ok: false, error: "The package's imsmanifest.xml could not be read." };
  }
  if (!root || typeof root !== "object") return { ok: false, error: "The package's imsmanifest.xml is not a SCORM manifest." };

  const version = text((root.metadata as Node | undefined)?.schemaversion);
  if (/2004|CAM 1\.3/i.test(version)) {
    return { ok: false, error: "This is a SCORM 2004 package. Only SCORM 1.2 is supported: export it again as SCORM 1.2." };
  }

  const organizations = root.organizations as Node | undefined;
  const all = asArray(organizations?.organization as Node | Node[] | undefined);
  const organization = all.find((o) => o["@identifier"] === organizations?.["@default"]) ?? all[0];
  const resources = asArray((root.resources as Node | undefined)?.resource as Node | Node[] | undefined);
  if (!organization || resources.length === 0) return { ok: false, error: "The package's manifest lists nothing to play." };

  const launchable = flattenItems(organization).filter((item) => item["@identifierref"]);
  if (launchable.length === 0) return { ok: false, error: "The package's manifest lists nothing to play." };
  if (launchable.length > 1) {
    return { ok: false, error: `This package has ${launchable.length} separate parts. Only packages that open as one item are supported: export it as a single SCO.` };
  }
  const item = launchable[0];
  const resource = resources.find((r) => r["@identifier"] === item["@identifierref"]);
  const href = text(resource?.["@href"]);
  if (!resource || !href) return { ok: false, error: "The package's manifest does not say which page starts the course." };

  // xml:base on the resource moves its files into a folder.
  const entry = normalisePath(`${text(resource["@base"])}${href}${text(item["@parameters"])}`.split(/[?#]/)[0]);
  if (!entry) return { ok: false, error: "The package's start page has an address that cannot be used." };

  const mastery = Number(text(item.masteryscore));
  return {
    ok: true,
    manifest: {
      title: text(item.title) || text(organization.title) || "SCORM package",
      entry,
      masteryScore: text(item.masteryscore) && Number.isFinite(mastery) ? Math.min(100, Math.max(0, Math.round(mastery))) : null,
      launchData: text(item.datafromlms) || null,
    },
  };
}
