import "server-only";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { SCORM_MAX_FILES, SCORM_MAX_UNPACKED_BYTES, normalisePath, scormContentType } from "@/lib/scorm";
import { parseScormManifest, type ScormManifest } from "@/lib/scorm-manifest";
import { generateScormPrefix, isPrivateStorageConfigured, privateStorage } from "@/lib/storage";

// Turning an uploaded SCORM zip into files a learner can be served: checked,
// then copied into its own folder of the private bucket. What a running
// package reports is in src/services/scorm.ts.

const openZip = (path: string) =>
  new Promise<ZipFile>((resolve, reject) => {
    // strictFileNames refuses backslashes and ".." before we ever see them.
    yauzl.open(path, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => (error || !zip ? reject(error) : resolve(zip)));
  });

const openEntry = (zip: ZipFile, entry: Entry) =>
  new Promise<Readable>((resolve, reject) => zip.openReadStream(entry, (error, stream) => (error || !stream ? reject(error) : resolve(stream))));

// Walks the zip one entry at a time; `visit` decides what to do with each file.
async function eachFile(path: string, visit: (zip: ZipFile, entry: Entry, name: string) => Promise<void>) {
  const zip = await openZip(path);
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry: Entry) => {
        // Folders have no content of their own.
        if (entry.fileName.endsWith("/")) return zip.readEntry();
        visit(zip, entry, entry.fileName).then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

async function readText(stream: Readable, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new PackageError("The package's imsmanifest.xml is too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const SMALL_FILE_BYTES = 8 * 1024 * 1024;
const UPLOADS_AT_ONCE = 12;

// A problem with the package itself, worded for the person who uploaded it.
class PackageError extends Error {}

export type UnpackedScorm = { prefix: string; manifest: ScormManifest; fileCount: number };
export type UnpackResult = { ok: true; data: UnpackedScorm } | { ok: false; error: string };

// Checks an uploaded zip is a SCORM 1.2 package and copies its files into a
// new folder of the private bucket. On any failure nothing is left behind.
export async function unpackScormPackage(courseId: number, zipKey: string): Promise<UnpackResult> {
  if (!isPrivateStorageConfigured()) return { ok: false, error: "Lesson file storage is not configured yet." };
  const folder = await mkdtemp(join(tmpdir(), "scorm-"));
  const zipPath = join(folder, "package.zip");
  const prefix = generateScormPrefix(courseId);
  let uploaded = false;

  try {
    const stored = await privateStorage.getObject(zipKey);
    if (!stored) return { ok: false, error: "The uploaded file could not be found." };
    await pipeline(stored.body, createWriteStream(zipPath));

    // First pass: every path is safe, the totals are sane, and the manifest reads.
    const names: string[] = [];
    let total = 0;
    let manifestXml: string | null = null;
    await eachFile(zipPath, async (zip, entry, name) => {
      const clean = normalisePath(name);
      if (!clean) throw new PackageError(`The package contains a file with an unsafe path ("${name.slice(0, 80)}").`);
      names.push(clean);
      total += entry.uncompressedSize;
      if (names.length > SCORM_MAX_FILES) throw new PackageError(`The package has more than ${SCORM_MAX_FILES} files.`);
      if (total > SCORM_MAX_UNPACKED_BYTES) throw new PackageError("The package is larger than 1 GB once unpacked.");
      if (clean === "imsmanifest.xml") manifestXml = await readText(await openEntry(zip, entry), 2 * 1024 * 1024);
    });
    if (manifestXml === null) {
      const nested = names.find((name) => name.endsWith("/imsmanifest.xml"));
      return {
        ok: false,
        error: nested
          ? `imsmanifest.xml is inside the folder "${nested.slice(0, -"/imsmanifest.xml".length)}" instead of at the top of the zip. Zip the contents of that folder, not the folder itself.`
          : "This zip is not a SCORM package: it has no imsmanifest.xml.",
      };
    }
    const parsed = parseScormManifest(manifestXml);
    if (!parsed.ok) return parsed;
    if (!names.includes(parsed.manifest.entry)) {
      return { ok: false, error: `The package's start page (${parsed.manifest.entry}) is missing from the zip.` };
    }

    // Second pass: copy the files across.
    uploaded = true;
    // Small files (nearly all of a package) are read into memory and sent
    // several at a time; a large one (a video) is streamed on its own.
    const sending = new Set<Promise<void>>();
    let failure: unknown = null;
    await eachFile(zipPath, async (zip, entry, name) => {
      if (failure) throw failure;
      const clean = normalisePath(name)!;
      const key = `${prefix}${clean}`;
      const stream = await openEntry(zip, entry);
      if (entry.uncompressedSize > SMALL_FILE_BYTES) {
        await privateStorage.putObject(key, stream, scormContentType(clean), entry.uncompressedSize);
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const job: Promise<void> = privateStorage
        .putObject(key, Buffer.concat(chunks), scormContentType(clean))
        .catch((error) => {
          failure = error;
        })
        .finally(() => sending.delete(job));
      sending.add(job);
      if (sending.size >= UPLOADS_AT_ONCE) await Promise.race(sending);
    });
    await Promise.all(sending);
    if (failure) throw failure;
    return { ok: true, data: { prefix, manifest: parsed.manifest, fileCount: names.length } };
  } catch (error) {
    if (uploaded) await removeScormFiles(prefix);
    if (error instanceof PackageError) return { ok: false, error: error.message };
    console.error("Failed to unpack a SCORM package", error);
    return { ok: false, error: "The zip could not be opened. Check it is a SCORM 1.2 package and upload it again." };
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}

// Deletes an unpacked package. Never throws: leftover files are harmless.
export async function removeScormFiles(prefix: string | null | undefined) {
  if (!prefix || !isPrivateStorageConfigured()) return;
  try {
    await privateStorage.deletePrefix(prefix);
  } catch (error) {
    console.error("Failed to delete an unpacked SCORM package", error);
  }
}
