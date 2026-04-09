import { normalizePhilippineMobileDigits } from "./philippinePhone";

export type RegistrationSource = "walk-in" | "online";

export function normalizePatientName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getPatientIdentityKey(record: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  fallbackId?: string | null;
}) {
  const email = record.email?.trim().toLowerCase() || "";
  if (email) return `email:${email}`;

  const name = normalizePatientName(record.name || "");
  const phone = normalizePhilippineMobileDigits(record.phone || "");

  if (name && phone) return `name:${name}|phone:${phone}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;

  return `id:${record.fallbackId || "unknown"}`;
}

export function inferRegistrationSource(record: {
  email?: string | null;
  registrationSource?: string | null;
}): RegistrationSource {
  const explicit = record.registrationSource?.trim().toLowerCase();
  if (explicit === "walk-in" || explicit === "walkin") return "walk-in";
  if (explicit === "online") return "online";

  return record.email?.trim() ? "online" : "walk-in";
}

export function formatRegistrationSource(source: RegistrationSource | string | null | undefined) {
  return inferRegistrationSource({ registrationSource: source || "" }) === "walk-in"
    ? "Walk-In"
    : "Online";
}
