import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatOMRYear(val: string | number | undefined | null): string {
  if (!val) return "";
  const s = String(val).trim();
  if (!s || s === " " || s === "-") return "";

  // If it's already 4 digits, leave it
  if (s.length === 4) return s;

  // If it's 2 digits or 1 digit, pad and prefix with 20
  if (s.length <= 2) return `20${s.padStart(2, "0")}`;

  return s;
}

/**
 * Normalizes OMR boolean-like values into a standard "Yes" or "No" display.
 * Handles variations like "SELECTED", "1", "0", "Y", "N", "Yes", "No", and blanks.
 */
export function normalizeOMRBoolean(val: any): "Yes" | "No" {
  if (!val) return "No";
  const s = String(val).trim().toUpperCase();
  if (s === "YES" || s === "Y" || s === "SELECTED" || s === "1" || s === "TRUE") return "Yes";
  return "No";
}
