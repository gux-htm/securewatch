import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "N/A";
  try {
    // Normalize PostgreSQL timestamp format (space separator) to ISO 8601
    const normalized = dateString.replace(" ", "T");
    return format(parseISO(normalized), "MMM dd, yyyy HH:mm:ss");
  } catch {
    return dateString;
  }
}
