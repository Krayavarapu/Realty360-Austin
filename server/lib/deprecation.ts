import type { Response } from "express";

export interface DeprecationNotice {
  endpoint: string;
  message: string;
  successor: string;
  sunset?: string;
}

export function applyDeprecationHeaders(
  res: Response,
  notice: DeprecationNotice,
): void {
  res.setHeader("Deprecation", "true");
  res.setHeader(
    "Link",
    `<${notice.successor}>; rel="successor-version"`,
  );
  res.setHeader(
    "Warning",
    `299 - "${notice.endpoint} is deprecated; use ${notice.successor}"`,
  );
}

export function deprecationPayload(notice: DeprecationNotice): {
  deprecated: true;
  deprecation: DeprecationNotice;
} {
  return { deprecated: true, deprecation: notice };
}
