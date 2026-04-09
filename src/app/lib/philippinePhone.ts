export function normalizePhilippineMobileDigits(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function formatPhilippineMobileInput(value: string) {
  const digits = normalizePhilippineMobileDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhilippineMobile(value: string) {
  const digits = normalizePhilippineMobileDigits(value);
  return /^9\d{9}$/.test(digits);
}

export function toInternationalPhilippineMobile(value: string) {
  const digits = normalizePhilippineMobileDigits(value);
  return isValidPhilippineMobile(digits) ? `+63${digits}` : "";
}

export function formatPhilippineMobileForDisplay(value: string | null | undefined) {
  if (!value) return "";

  const digits = normalizePhilippineMobileDigits(value);
  if (!digits) return value;

  return formatPhilippineMobileInput(digits);
}
