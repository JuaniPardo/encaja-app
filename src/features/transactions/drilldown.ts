import type { TransactionType } from "@/types/database";

type TransactionsDrilldownParams = {
  year?: number;
  month?: number;
  type?: TransactionType;
  categoryId?: string;
  paymentMethodId?: string;
  search?: string;
};

export function buildTransactionsDrilldownHref(params: TransactionsDrilldownParams) {
  const searchParams = new URLSearchParams();

  if (Number.isInteger(params.year)) {
    searchParams.set("year", String(params.year));
  }

  if (Number.isInteger(params.month)) {
    searchParams.set("month", String(params.month));
  }

  if (params.type) {
    searchParams.set("type", params.type);
  }

  if (params.categoryId && params.categoryId.trim() !== "") {
    searchParams.set("categoryId", params.categoryId);
  }

  if (params.paymentMethodId && params.paymentMethodId.trim() !== "") {
    searchParams.set("paymentMethodId", params.paymentMethodId);
  }

  if (params.search && params.search.trim() !== "") {
    searchParams.set("search", params.search.trim());
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/app/transactions?${query}` : "/app/transactions";
}
