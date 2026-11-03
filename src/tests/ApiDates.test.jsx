import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  apiDateToLocal,
  apiDateToLocalDay,
  formatApiDate,
  isCalendarDay,
} from "../core/helpers/apiDates";

// TEOS-229: the API sends UTC timestamps without an offset. These checks hold in any time zone.
describe("apiDates", () => {
  it("reads a timestamp without an offset as UTC", () => {
    expect(apiDateToLocal("2026-11-09T22:00:00").toISOString()).toBe("2026-11-09T22:00:00.000Z");
  });

  it("keeps a timestamp that already has Z or an offset", () => {
    expect(apiDateToLocal("2026-11-09T22:00:00Z").toISOString()).toBe("2026-11-09T22:00:00.000Z");
    expect(apiDateToLocal("2026-11-10T00:00:00+02:00").toISOString()).toBe("2026-11-09T22:00:00.000Z");
  });

  it("gives back the local day a promotion was created with (no drift)", () => {
    // what the form sends for 10 Nov (local start of day), as the API returns it: UTC without "Z"
    const stored = dayjs("2026-11-10").startOf("day").toISOString().replace(/\.000Z$/, "");
    expect(apiDateToLocalDay(stored)).toBe("2026-11-10");
    const storedEnd = dayjs("2026-11-12").endOf("day").toISOString().replace(/Z$/, "");
    expect(apiDateToLocalDay(storedEnd)).toBe("2026-11-12");
  });

  it("handles empty values", () => {
    expect(apiDateToLocal(null)).toBeNull();
    expect(apiDateToLocalDay(undefined)).toBeNull();
    expect(formatApiDate("")).toBe("N/A");
  });
});

// TEOS-274 / TEOS-275: dayjs rolls impossible dates over, so they must be refused here
describe("isCalendarDay", () => {
  it.each(["2026-05-01", "2024-02-29", "2026-12-31"])("accepts the real day %s", (value) => {
    expect(isCalendarDay(value)).toBe(true);
  });

  it.each(["2026-99-99", "2026-13-01", "2026-02-30", "2025-02-29", "2026-00-10", "abc", "2026-5-1", "", null, undefined])(
    "refuses %s",
    (value) => {
      expect(isCalendarDay(value)).toBe(false);
    }
  );
});
