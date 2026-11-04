export type LoadSettlement = {
  key: string;
  failed: boolean;
};

export type LoadStatus = "loading" | "ready" | "failed";

export type BudgetLoadNotice = "baseFailed" | "periodFailed" | "noPeriod" | null;

export class BudgetLoadError extends Error {
  constructor(
    readonly titleKey: string,
    cause: unknown,
  ) {
    super(titleKey, { cause });
    this.name = "BudgetLoadError";
  }
}

export function buildBaseLoadKey(workspaceId: string, locale: string, reloadCount: number) {
  return `${workspaceId}:${locale}:${reloadCount}`;
}

export function buildPeriodLoadKey({
  baseLoadKey,
  year,
  month,
  reloadCount,
}: {
  baseLoadKey: string;
  year: number;
  month: number;
  reloadCount: number;
}) {
  return `${baseLoadKey}:${year}-${month}:${reloadCount}`;
}

export function deriveLoadStatus(
  requestedKey: string,
  settlement: LoadSettlement | null,
): LoadStatus {
  if (settlement?.key !== requestedKey) {
    return "loading";
  }

  return settlement.failed ? "failed" : "ready";
}

export function hasFailedResponse(responses: Array<{ error: unknown }>) {
  return responses.some((response) => Boolean(response.error));
}

// Lee el último resultado aunque sea de una clave anterior: así la alerta sigue visible, con
// el reintento deshabilitado, mientras se reintenta.
export function resolveBudgetLoadNotice({
  baseLoad,
  periodLoad,
  hasPeriod,
}: {
  baseLoad: LoadSettlement | null;
  periodLoad: LoadSettlement | null;
  hasPeriod: boolean;
}): BudgetLoadNotice {
  if (baseLoad?.failed) {
    return "baseFailed";
  }

  if (periodLoad?.failed) {
    return "periodFailed";
  }

  return hasPeriod ? null : "noPeriod";
}

export function startLatestLoad<T>({
  load,
  onLoaded,
  onFailed,
}: {
  load: () => Promise<T>;
  onLoaded: (result: T) => void;
  onFailed: (error: unknown) => void;
}) {
  let isCancelled = false;

  const run = async () => {
    try {
      const result = await load();

      if (!isCancelled) {
        onLoaded(result);
      }
    } catch (error) {
      if (!isCancelled) {
        onFailed(error);
      }
    }
  };

  void run();

  return () => {
    isCancelled = true;
  };
}
