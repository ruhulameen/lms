import { describe, expect, it } from "vitest";
import {
  formatScormTime,
  normalisePath,
  parseScormTime,
  resolveScormStatus,
  sanitiseScormProgress,
  scormContentType,
  scormStatusCompletes,
} from "@/lib/scorm";
import { parseScormManifest } from "@/lib/scorm-manifest";

const manifest = (body: string, version = "1.2") => `<?xml version="1.0" ?>
<manifest identifier="m1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>${version}</schemaversion></metadata>
  ${body}
</manifest>`;

const rise = manifest(`
  <organizations default="articulate_rise">
    <organization identifier="articulate_rise">
      <title>Time Management </title>
      <item identifier="i1" identifierref="r1" isvisible="true">
        <title>Time Management </title>
        <adlcp:datafromlms>datafromlms</adlcp:datafromlms>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="scormdriver/indexAPI.html">
      <file href="scormcontent/index.html" />
    </resource>
  </resources>`);

describe("parseScormManifest", () => {
  it("reads the title, start page, pass mark and launch data of a single-item package", () => {
    expect(parseScormManifest(rise)).toEqual({
      ok: true,
      manifest: { title: "Time Management", entry: "scormdriver/indexAPI.html", masteryScore: 80, launchData: "datafromlms" },
    });
  });

  it("refuses SCORM 2004, several items, and a start page outside the package", () => {
    expect(parseScormManifest(manifest("", "2004 3rd Edition"))).toMatchObject({ ok: false, error: expect.stringContaining("SCORM 2004") });
    const two = rise.replace("</organization>", '<item identifier="i2" identifierref="r1"><title>Two</title></item></organization>');
    expect(parseScormManifest(two)).toMatchObject({ ok: false, error: expect.stringContaining("2 separate parts") });
    expect(parseScormManifest(rise.replace("scormdriver/indexAPI.html", "../../etc/passwd"))).toMatchObject({ ok: false });
    expect(parseScormManifest("not xml at all")).toMatchObject({ ok: false });
  });
});

describe("package file paths", () => {
  it("keeps plain relative paths and refuses anything that leaves the folder", () => {
    expect(normalisePath("scormcontent/./lib//rise/a.js")).toBe("scormcontent/lib/rise/a.js");
    for (const bad of ["../secret", "a/../../b", "/etc/passwd", "a\\b", "https://evil.test/x", "", "a\0b"]) {
      expect(normalisePath(bad)).toBeNull();
    }
  });

  it("serves known types as themselves and unknown ones as downloads", () => {
    expect(scormContentType("scormdriver/indexAPI.html")).toBe("text/html; charset=utf-8");
    expect(scormContentType("lib/A.JS")).toBe("text/javascript; charset=utf-8");
    expect(scormContentType("run.exe")).toBe("application/octet-stream");
  });
});

describe("what a package reports", () => {
  it("counts finished or passed as done, and applies the manifest's pass mark", () => {
    expect(scormStatusCompletes("completed")).toBe(true);
    expect(scormStatusCompletes("passed")).toBe(true);
    expect(scormStatusCompletes("failed")).toBe(false);
    expect(scormStatusCompletes("incomplete")).toBe(false);
    expect(resolveScormStatus("completed", 85, 80)).toBe("passed");
    expect(resolveScormStatus("completed", 60, 80)).toBe("failed");
    expect(resolveScormStatus("completed", null, 80)).toBe("completed");
    expect(resolveScormStatus("incomplete", 40, null)).toBe("incomplete");
  });

  it("reads and writes SCORM time", () => {
    expect(parseScormTime("0001:02:03.45")).toBe(3723);
    expect(parseScormTime("nonsense")).toBe(0);
    expect(formatScormTime(3723)).toBe("0001:02:03");
  });

  it("accepts only well-formed progress from the browser", () => {
    expect(sanitiseScormProgress({ lessonStatus: "completed", lessonLocation: "5", scoreRaw: 90, suspendData: "abc", sessionSeconds: 30 })).toMatchObject({
      lessonStatus: "completed",
      lessonLocation: "5",
      scoreRaw: 90,
      scoreMin: null,
      suspendData: "abc",
      sessionSeconds: 30,
    });
    expect(sanitiseScormProgress({ lessonStatus: "done" })).toBeNull();
    expect(sanitiseScormProgress({ lessonStatus: "passed", suspendData: "x".repeat(1024 * 1024 + 1) })).toBeNull();
    expect(sanitiseScormProgress({ lessonStatus: "passed", sessionSeconds: 9e9 })?.sessionSeconds).toBe(12 * 3600);
  });
});
