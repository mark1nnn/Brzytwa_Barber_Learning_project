import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  customerEmailSchema,
  customerNameSchema,
  customerNotesSchema,
  customerPhoneSchema,
  localDateSchema,
  normalizePolishPhone,
  positiveIntegerIdSchema,
  privacyNoticeSchema,
  utcTimestampSchema,
  zodIssuesToFieldErrors,
} from "../../functions/_shared/validation";

describe("positive integer IDs", () => {
  it.each([1, 2, 25, "1", "25"])("accepts %s", (value) => {
    expect(positiveIntegerIdSchema.parse(value)).toBe(Number(value));
  });

  it.each([0, -1, 1.5, "0", "-1", "1.5", "abc"])(
    "rejects %s",
    (value) => {
      expect(positiveIntegerIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("customer name", () => {
  it.each([
    "Jan Kowalski",
    "Michał Nowak",
    "Олександр Коваль",
    "Anna-Maria Nowak",
    "O'Connor",
  ])("accepts %s", (value) => {
    expect(customerNameSchema.parse(`  ${value}  `)).toBe(value);
  });

  it.each(["!!!", "123456", "-", " "])("rejects %s", (value) => {
    expect(customerNameSchema.safeParse(value).success).toBe(false);
  });
});

describe("Polish phone normalization", () => {
  it.each([
    "123456789",
    "+48123456789",
    "123 456 789",
    "123-456-789",
    "+48 123 456 789",
    "+48-123-456-789",
  ])("normalizes %s", (value) => {
    expect(normalizePolishPhone(value)).toBe("+48123456789");
    expect(customerPhoneSchema.parse(value)).toBe("+48123456789");
  });

  it.each([
    "123",
    "+49123456789",
    "abc123456789",
    "+++++++++",
    "1234567890",
  ])("rejects %s", (value) => {
    expect(normalizePolishPhone(value)).toBeNull();
    expect(customerPhoneSchema.safeParse(value).success).toBe(false);
  });
});

describe("email and notes normalization", () => {
  it("trims and lowercases a valid email", () => {
    expect(customerEmailSchema.parse("  JAN@Example.COM ")).toBe(
      "jan@example.com",
    );
  });

  it("rejects invalid and oversized email values", () => {
    expect(customerEmailSchema.safeParse("not-an-email").success).toBe(
      false,
    );
    expect(
      customerEmailSchema.safeParse(
        `${"a".repeat(245)}@example.com`,
      ).success,
    ).toBe(false);
  });

  it("normalizes missing and blank notes to null", () => {
    expect(customerNotesSchema.parse(undefined)).toBeNull();
    expect(customerNotesSchema.parse("")).toBeNull();
    expect(customerNotesSchema.parse("   ")).toBeNull();
  });

  it("preserves notes as plain text", () => {
    expect(customerNotesSchema.parse("<b>bez zmian</b>")).toBe(
      "<b>bez zmian</b>",
    );
  });

  it("enforces the notes length limit", () => {
    expect(customerNotesSchema.parse("a".repeat(500))).toHaveLength(500);
    expect(
      customerNotesSchema.safeParse("a".repeat(501)).success,
    ).toBe(false);
  });
});

describe("privacy, dates, and timestamps", () => {
  it("accepts only literal true for privacy acknowledgement", () => {
    expect(privacyNoticeSchema.parse(true)).toBe(true);

    for (const value of [false, "true", 1, null, undefined]) {
      expect(privacyNoticeSchema.safeParse(value).success).toBe(false);
    }
  });

  it.each(["2026-02-28", "2028-02-29"])(
    "accepts local date %s",
    (value) => {
      expect(localDateSchema.parse(value)).toBe(value);
    },
  );

  it.each(["2026-02-29", "2026-02-30", "2026-13-01"])(
    "rejects local date %s",
    (value) => {
      expect(localDateSchema.safeParse(value).success).toBe(false);
    },
  );

  it("requires UTC timestamps with Z", () => {
    expect(
      utcTimestampSchema.parse("2026-07-15T08:00:00.000Z"),
    ).toBe("2026-07-15T08:00:00.000Z");
    expect(
      utcTimestampSchema.safeParse("2026-07-15T10:00:00").success,
    ).toBe(false);
  });
});

describe("Zod field errors", () => {
  it("returns the first readable message for each nested field", () => {
    const schema = z.object({
      customer: z.object({
        email: customerEmailSchema,
      }),
    });
    const result = schema.safeParse({
      customer: {
        email: "invalid",
      },
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(zodIssuesToFieldErrors(result.error.issues)).toEqual({
      "customer.email": "Podaj prawidłowy adres e-mail.",
    });
  });
});
