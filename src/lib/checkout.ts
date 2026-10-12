import { z } from "zod";

// Billing details asked for in the first checkout step.

export const billingCountries = [
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
] as const;

const countryCodes = billingCountries.map((c) => c.code) as [string, ...string[]];

const required = (label: string, max: number) =>
  z.string().trim().min(1, `Enter ${label}.`).max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long.`);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "That is too long.")
    .transform((value) => (value === "" ? null : value));

export const billingSchema = z
  .object({
    customerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
    firstName: required("your first name", 80),
    lastName: required("your last name", 80),
    company: optional(120),
    addressLine1: required("a house number or name", 120),
    addressLine2: optional(120),
    city: optional(80),
    postcode: required("a postcode", 20),
    country: z.enum(countryCodes, "Choose a country."),
    phone: optional(40).refine((value) => value === null || /^[0-9+()\-\s.]{5,40}$/.test(value), "Enter a valid phone number."),
  })
  .refine((data) => data.customerType !== "BUSINESS" || data.company !== null, {
    path: ["company"],
    message: "Enter your company name.",
  });

export type BillingDetails = z.infer<typeof billingSchema>;

// The values the billing form shows (strings only).
export type BillingFormValues = {
  customerType: "INDIVIDUAL" | "BUSINESS";
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
};

export const billingFields = [
  "customerType",
  "firstName",
  "lastName",
  "company",
  "addressLine1",
  "addressLine2",
  "city",
  "postcode",
  "country",
  "phone",
] as const;
