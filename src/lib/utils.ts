import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NEW_JOIN_WINDOW_DAYS = 7;

export function countNewSince(
  createdAts: (string | null)[],
  days = NEW_JOIN_WINDOW_DAYS,
): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return createdAts.filter(
    (d) => d != null && new Date(d).getTime() >= cutoff,
  ).length;
}
