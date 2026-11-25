import { describe, expect, it } from "vitest";
import { actorLabel } from "../core/helpers/auditJson";

const ID = "11111111-1111-1111-1111-111111111111";

describe("actorLabel: the audit log / settings history 'Changed by' (TEOS-341)", () => {
  it("shows the admin's email, the email saved with the row included (no mark)", () => {
    expect(actorLabel({ id: ID, email: "boss@example.com" })).toBe("boss@example.com");
    expect(actorLabel({ id: ID, email: "old.admin@x.com", phone: "+96170000000", role: "admin" })).toBe(
      "old.admin@x.com"
    );
  });

  it("shows N/A, never the id or the phone, when there is no email", () => {
    expect(actorLabel({ id: ID, email: null, phone: "+96170000000" })).toBe("N/A");
    expect(actorLabel({ id: ID })).toBe("N/A");
  });

  it("shows Deleted user when the API has no admin for the row", () => {
    expect(actorLabel(null)).toBe("Deleted user");
    expect(actorLabel(undefined)).toBe("Deleted user");
  });
});
