export interface AddressParts {
  address_line: string;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

/** e.g. "5314 Aurora Dr, Austin, TX 78756" */
export function formatPropertyAddress(parts: AddressParts): string {
  const cityStateZip = [
    parts.city,
    [parts.state, parts.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return cityStateZip
    ? `${parts.address_line}, ${cityStateZip}`
    : parts.address_line;
}

export function formatSoldDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatDistanceMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(2)} mi` : `${miles.toFixed(1)} mi`;
}
