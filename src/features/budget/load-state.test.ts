import { describe, expect, it, vi } from "vitest";

import {
  buildBaseLoadKey,
  buildPeriodLoadKey,
  deriveLoadStatus,
  hasFailedResponse,
  resolveBudgetLoadNotice,
  startLatestLoad,
  type LoadSettlement,
} from "@/features/budget/load-state";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

function periodKey(month: number, reloadCount = 0) {
  return buildPeriodLoadKey({ baseLoadKey: "base", year: 2026, month, reloadCount });
}

// Reproduce el ciclo del effect de la página: cada clave nueva cancela la carga anterior.
function createPeriodPage() {
  const applied: string[] = [];
  let settlement: LoadSettlement | null = null;
  let requestedKey = "";
  let cancelCurrent = () => {};

  return {
    applied,
    request(key: string, load: () => Promise<string>) {
      cancelCurrent();
      requestedKey = key;
      cancelCurrent = startLatestLoad({
        load,
        onLoaded: (value) => {
          applied.push(value);
          settlement = { key, failed: false };
        },
        onFailed: () => {
          settlement = { key, failed: true };
        },
      });
    },
    status: () => deriveLoadStatus(requestedKey, settlement),
  };
}

describe("deriveLoadStatus", () => {
  it("indica carga mientras nada se resolvió", () => {
    expect(deriveLoadStatus(periodKey(3), null)).toBe("loading");
  });

  it("indica carga si lo resuelto es otro período", () => {
    expect(deriveLoadStatus(periodKey(3), { key: periodKey(2), failed: false })).toBe("loading");
  });

  it("indica carga si lo resuelto es del período pero previo a una recarga", () => {
    expect(deriveLoadStatus(periodKey(3, 1), { key: periodKey(3, 0), failed: false })).toBe(
      "loading",
    );
  });

  it("queda listo cuando lo resuelto coincide con lo pedido", () => {
    expect(deriveLoadStatus(periodKey(3), { key: periodKey(3), failed: false })).toBe("ready");
  });

  it("distingue una carga fallida de una exitosa", () => {
    expect(deriveLoadStatus(periodKey(3), { key: periodKey(3), failed: true })).toBe("failed");
  });

  it("vuelve a cargar al pedir otro período después de un fallo", () => {
    expect(deriveLoadStatus(periodKey(4), { key: periodKey(3), failed: true })).toBe("loading");
  });
});

describe("claves de carga", () => {
  it("cambian la clave del período con la carga base", () => {
    const params = { year: 2026, month: 3, reloadCount: 0 };

    expect(
      buildPeriodLoadKey({ ...params, baseLoadKey: buildBaseLoadKey("workspace-a", "es", 0) }),
    ).not.toBe(
      buildPeriodLoadKey({ ...params, baseLoadKey: buildBaseLoadKey("workspace-b", "es", 0) }),
    );
    expect(
      buildPeriodLoadKey({ ...params, baseLoadKey: buildBaseLoadKey("workspace-a", "es", 0) }),
    ).not.toBe(
      buildPeriodLoadKey({ ...params, baseLoadKey: buildBaseLoadKey("workspace-a", "en", 0) }),
    );
  });

  it("no confunden períodos cuyo año y mes se concatenan igual", () => {
    expect(
      buildPeriodLoadKey({ baseLoadKey: "base", year: 2026, month: 1, reloadCount: 1 }),
    ).not.toBe(buildPeriodLoadKey({ baseLoadKey: "base", year: 2026, month: 11, reloadCount: 0 }));
  });
});

describe("reintento de la carga base", () => {
  const failedKey = buildBaseLoadKey("workspace-a", "es", 0);
  const retryKey = buildBaseLoadKey("workspace-a", "es", 1);

  it("cambia la clave base para que el effect vuelva a cargar", () => {
    expect(retryKey).not.toBe(failedKey);
  });

  it("vuelve a mostrar carga después de un fallo", () => {
    expect(deriveLoadStatus(failedKey, { key: failedKey, failed: true })).toBe("failed");
    expect(deriveLoadStatus(retryKey, { key: failedKey, failed: true })).toBe("loading");
  });

  it("recarga también el período, que pudo haber fallado por la misma causa", () => {
    const params = { year: 2026, month: 3, reloadCount: 0 };

    expect(buildPeriodLoadKey({ ...params, baseLoadKey: retryKey })).not.toBe(
      buildPeriodLoadKey({ ...params, baseLoadKey: failedKey }),
    );
  });
});

describe("hasFailedResponse", () => {
  it("detecta un error de Supabase, que llega en la respuesta y no como excepción", () => {
    expect(hasFailedResponse([{ error: null }, { error: { message: "timeout" } }])).toBe(true);
  });

  it("no marca fallo si todas las respuestas son correctas", () => {
    expect(hasFailedResponse([{ error: null }, { error: null }])).toBe(false);
  });
});

describe("resolveBudgetLoadNotice", () => {
  const ok = { key: "actual", failed: false };
  const failed = { key: "actual", failed: true };

  it("no avisa nada si hay período y las cargas salieron bien", () => {
    expect(resolveBudgetLoadNotice({ baseLoad: ok, periodLoad: ok, hasPeriod: true })).toBeNull();
  });

  it("avisa que el período todavía no tiene presupuesto", () => {
    expect(resolveBudgetLoadNotice({ baseLoad: ok, periodLoad: ok, hasPeriod: false })).toBe(
      "noPeriod",
    );
  });

  it("distingue el fallo base del estado sin categorías", () => {
    expect(resolveBudgetLoadNotice({ baseLoad: failed, periodLoad: ok, hasPeriod: true })).toBe(
      "baseFailed",
    );
  });

  it("muestra un solo error si fallan las dos cargas, porque reintentar la base recarga ambas", () => {
    expect(resolveBudgetLoadNotice({ baseLoad: failed, periodLoad: failed, hasPeriod: false })).toBe(
      "baseFailed",
    );
  });

  it("prefiere el error del período antes que el aviso de período vacío", () => {
    expect(resolveBudgetLoadNotice({ baseLoad: ok, periodLoad: failed, hasPeriod: false })).toBe(
      "periodFailed",
    );
  });

  it("mantiene la alerta mientras se reintenta, aunque lo fallido sea de la clave anterior", () => {
    const stalePeriod = { key: "anterior", failed: true };

    expect(deriveLoadStatus("reintento", stalePeriod)).toBe("loading");
    expect(
      resolveBudgetLoadNotice({ baseLoad: ok, periodLoad: stalePeriod, hasPeriod: false }),
    ).toBe("periodFailed");
  });
});

describe("startLatestLoad", () => {
  it("entrega el resultado de la carga vigente", async () => {
    const onLoaded = vi.fn();
    const onFailed = vi.fn();

    startLatestLoad({ load: async () => "marzo", onLoaded, onFailed });
    await flushPromises();

    expect(onLoaded).toHaveBeenCalledOnce();
    expect(onLoaded).toHaveBeenCalledWith("marzo");
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("nunca avisa de forma síncrona, para poder arrancar dentro de un effect", async () => {
    const onLoaded = vi.fn();

    startLatestLoad({ load: async () => "marzo", onLoaded, onFailed: vi.fn() });

    expect(onLoaded).not.toHaveBeenCalled();
    await flushPromises();
    expect(onLoaded).toHaveBeenCalledOnce();
  });

  it("ignora el resultado de una carga cancelada", async () => {
    const deferred = createDeferred<string>();
    const onLoaded = vi.fn();
    const onFailed = vi.fn();

    const cancel = startLatestLoad({ load: () => deferred.promise, onLoaded, onFailed });
    cancel();
    deferred.resolve("febrero");
    await flushPromises();

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("ignora el error de una carga cancelada", async () => {
    const deferred = createDeferred<string>();
    const onLoaded = vi.fn();
    const onFailed = vi.fn();

    const cancel = startLatestLoad({ load: () => deferred.promise, onLoaded, onFailed });
    cancel();
    deferred.reject(new Error("timeout"));
    await flushPromises();

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("informa una carga que rechaza", async () => {
    const error = new Error("sin red");
    const onLoaded = vi.fn();
    const onFailed = vi.fn();

    startLatestLoad({ load: () => Promise.reject(error), onLoaded, onFailed });
    await flushPromises();

    expect(onFailed).toHaveBeenCalledOnce();
    expect(onFailed).toHaveBeenCalledWith(error);
    expect(onLoaded).not.toHaveBeenCalled();
  });
});

describe("cambio rápido de período", () => {
  it("la respuesta vieja que llega última no pisa a la nueva", async () => {
    const february = createDeferred<string>();
    const march = createDeferred<string>();
    const page = createPeriodPage();

    page.request(periodKey(2), () => february.promise);
    page.request(periodKey(3), () => march.promise);

    march.resolve("marzo");
    await flushPromises();
    february.resolve("febrero");
    await flushPromises();

    expect(page.applied).toEqual(["marzo"]);
    expect(page.status()).toBe("ready");
  });

  it("sigue cargando si responde primero el período viejo", async () => {
    const february = createDeferred<string>();
    const march = createDeferred<string>();
    const page = createPeriodPage();

    page.request(periodKey(2), () => february.promise);
    page.request(periodKey(3), () => march.promise);

    february.resolve("febrero");
    await flushPromises();

    expect(page.applied).toEqual([]);
    expect(page.status()).toBe("loading");

    march.resolve("marzo");
    await flushPromises();

    expect(page.applied).toEqual(["marzo"]);
    expect(page.status()).toBe("ready");
  });

  it("un error de la carga vieja no marca como fallida a la nueva", async () => {
    const february = createDeferred<string>();
    const march = createDeferred<string>();
    const page = createPeriodPage();

    page.request(periodKey(2), () => february.promise);
    page.request(periodKey(3), () => march.promise);

    march.resolve("marzo");
    await flushPromises();
    february.reject(new Error("timeout"));
    await flushPromises();

    expect(page.status()).toBe("ready");
  });
});

describe("carga con error", () => {
  it("deja de cargar y queda marcada como fallida", async () => {
    const page = createPeriodPage();

    page.request(periodKey(3), () => Promise.reject(new Error("sin red")));
    expect(page.status()).toBe("loading");
    await flushPromises();

    expect(page.status()).toBe("failed");
    expect(page.applied).toEqual([]);
  });

  it("una recarga posterior vuelve a mostrar carga y se recupera", async () => {
    const retry = createDeferred<string>();
    const page = createPeriodPage();

    page.request(periodKey(3, 0), () => Promise.reject(new Error("sin red")));
    await flushPromises();

    page.request(periodKey(3, 1), () => retry.promise);
    expect(page.status()).toBe("loading");

    retry.resolve("marzo");
    await flushPromises();

    expect(page.status()).toBe("ready");
    expect(page.applied).toEqual(["marzo"]);
  });
});

describe("recarga desde un handler", () => {
  it("muestra carga en el mismo período ya resuelto y aplica los datos nuevos", async () => {
    const reload = createDeferred<string>();
    const page = createPeriodPage();

    page.request(periodKey(3, 0), async () => "marzo");
    await flushPromises();
    expect(page.status()).toBe("ready");

    page.request(periodKey(3, 1), () => reload.promise);
    expect(page.status()).toBe("loading");

    reload.resolve("marzo guardado");
    await flushPromises();

    expect(page.applied).toEqual(["marzo", "marzo guardado"]);
    expect(page.status()).toBe("ready");
  });
});
