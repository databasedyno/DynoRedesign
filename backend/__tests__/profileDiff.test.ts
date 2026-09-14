import { diffCompanyFields } from "../controller/company/profileDiff";

const before = {
  company_name: "Nameword",
  email: "hello@nameword.com",
  mobile: "+351912345678",
  website: "https://nameword.com",
  address_line1: "Rua A 1",
  address_line2: null,
  city: "Lisbon",
  state: "Lisboa",
  country: "PT",
  zip_code: "1000-001",
  vat_number: "PT123456789",
  underpayment_threshold_usd: "5.00",
  photo: "https://cdn/old.png",
};

describe("diffCompanyFields", () => {
  it("logo-only upload with the full form re-posted lists ONLY Brand Logo", () => {
    const data = { ...before, address_line2: "" };
    delete (data as Record<string, unknown>).photo;
    expect(diffCompanyFields(before, data, "https://cdn/new.png")).toEqual(["Brand Logo"]);
  });

  it("nothing changed → empty list (no email)", () => {
    expect(diffCompanyFields(before, { company_name: "Nameword", email: "hello@nameword.com" })).toEqual([]);
  });

  it("groups address columns and labels other keys as Payment Settings", () => {
    const out = diffCompanyFields(before, { city: "Porto", zip_code: "4000-001", underpayment_threshold_usd: 7, grace_period_minutes: 15 });
    expect(out).toEqual(["Address", "Payment Settings"]);
  });

  it("numeric strings equal to numbers are not a change", () => {
    expect(diffCompanyFields(before, { underpayment_threshold_usd: 5 })).toEqual([]);
  });

  it("contact name columns map to Contact Name", () => {
    expect(diffCompanyFields({ ...before, contact_first_name: "John" }, { contact_first_name: "Jane", contact_last_name: "Doe" })).toEqual(["Contact Name"]);
  });
});
