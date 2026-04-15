import type { Database } from "@/types/database";

type TransactionType = Database["public"]["Tables"]["transactions"]["Row"]["type"];

type TransferExcludableQuery = {
  neq: (column: "type", value: TransactionType) => unknown;
};

/**
 * Excluye las transferencias de una consulta de transacciones.
 * Según MVP 22, las transferencias no deben afectar el presupuesto ni mostrarse en dashboards por defecto.
 */
export function excludeTransfers<TQuery extends TransferExcludableQuery>(query: TQuery): TQuery {
  query.neq("type", "transfer");
  return query;
}
