import { Prisma } from "@prisma/client";

export function buildNgReasonWhere(ngReason?: string): Prisma.ScanRecordWhereInput | undefined {
  const code = ngReason?.trim();
  if (!code) {
    return undefined;
  }

  const reasonFilter: Prisma.StringNullableFilter = {
    equals: code,
    mode: Prisma.QueryMode.insensitive
  };

  return {
    OR: [
      { ng_reason: reasonFilter },
      { led_items: { some: { ng_reason: reasonFilter } } }
    ]
  };
}
