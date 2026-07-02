import { describe, expect, it } from "vitest";

import {
  generateBookingCode,
  generateUuid,
} from "../../functions/_shared/ids";

describe("identifier generation", () => {
  it("generates a version 4 UUID", () => {
    expect(generateUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates booking candidates with an unambiguous alphabet", () => {
    const codes = Array.from({ length: 32 }, () =>
      generateBookingCode(),
    );

    for (const code of codes) {
      expect(code).toMatch(/^BK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      expect(code).not.toMatch(/[0O1IL]/);
    }

    expect(new Set(codes).size).toBeGreaterThan(1);
  });
});
