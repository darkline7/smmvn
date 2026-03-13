import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: unknown, currency?: string | null) {
  const num = Number(amount) || 0;
  const cur = (currency && typeof currency === "string" && currency.trim().length === 3)
    ? currency.trim().toUpperCase()
    : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

export function formatNumber(num: unknown) {
  return new Intl.NumberFormat("en-US").format(Number(num) || 0);
}
