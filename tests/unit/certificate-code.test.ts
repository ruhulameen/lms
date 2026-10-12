import { describe, expect, it } from "vitest";
import { CERTIFICATE_CODE_PATTERN, generateCertificateCode, normaliseCertificateCode } from "@/lib/course";

describe("generateCertificateCode", () => {
  it("matches the code pattern and avoids look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCertificateCode();
      expect(code).toMatch(CERTIFICATE_CODE_PATTERN);
      expect(code.slice(4)).not.toMatch(/[01OIL]/);
    }
  });
  it("maps random bytes to the alphabet and skips biased bytes", () => {
    // 248+ would favour the first symbols; 0 -> "2", 1 -> "3".
    const bytes = [255, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 250, 0, 0];
    expect(generateCertificateCode(() => Uint8Array.from(bytes))).toBe("LMS-2323-2323-2323");
  });
});

describe("normaliseCertificateCode", () => {
  it("accepts lower case, spaces and a missing prefix or dashes", () => {
    expect(normaliseCertificateCode("lms-abcd-2345-wxyz")).toBe("LMS-ABCD-2345-WXYZ");
    expect(normaliseCertificateCode("  ABCD 2345 WXYZ ")).toBe("LMS-ABCD-2345-WXYZ");
    expect(normaliseCertificateCode("lmsabcd2345wxyz")).toBe("LMS-ABCD-2345-WXYZ");
  });
  it("rejects wrong length and characters outside the alphabet", () => {
    expect(normaliseCertificateCode("")).toBeNull();
    expect(normaliseCertificateCode("LMS-ABCD-2345")).toBeNull();
    expect(normaliseCertificateCode("LMS-ABCD-2345-WXY0")).toBeNull();
    expect(normaliseCertificateCode("LMS-ABCD-2345-WXYZ-9999")).toBeNull();
  });
});
