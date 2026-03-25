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
