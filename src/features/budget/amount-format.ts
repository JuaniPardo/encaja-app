const budgetAmountFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function toNormalizedNumericText(rawValue: string) {
  const normalizedRaw = rawValue.replace(/\s/g, "").replace(/\$/g, "");
  const cleaned = normalizedRaw.replace(/[^\d.,]/g, "");

  if (cleaned === "") {
    return "";
  }

  if (cleaned.includes(",")) {
    const lastComma = cleaned.lastIndexOf(",");
    const integerPart = cleaned.slice(0, lastComma).replace(/[^\d]/g, "");
    const decimalPart = cleaned
      .slice(lastComma + 1)
      .replace(/[^\d]/g, "")
      .slice(0, 2);

    if (decimalPart.length === 0) {
      return integerPart === "" ? "0" : integerPart;
    }

    return `${integerPart === "" ? "0" : integerPart}.${decimalPart}`;
  }

  const dots = cleaned.match(/\./g)?.length ?? 0;

  if (dots === 0) {
    return cleaned.replace(/[^\d]/g, "");
  }

  if (dots > 1) {
    return cleaned.replace(/\./g, "").replace(/[^\d]/g, "");
  }

  const [leftPart, rightPart = ""] = cleaned.split(".");
  const integerPart = leftPart.replace(/[^\d]/g, "");
  const decimalPart = rightPart.replace(/[^\d]/g, "");

  if (decimalPart.length > 0 && decimalPart.length <= 2) {
    return `${integerPart === "" ? "0" : integerPart}.${decimalPart}`;
  }

  return `${integerPart}${decimalPart}`;
}

export function sanitizeBudgetTypingValue(value: string) {
  return value.replace(/\s/g, "").replace(/\$/g, "").replace(/[^\d.,]/g, "");
}

export function parseBudgetAmount(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    return value;
  }

  const rawValue = String(value).trim();
  if (rawValue === "") {
    return null;
  }

  const numericText = toNormalizedNumericText(rawValue);
  if (numericText === "") {
    return null;
  }

  const parsed = Number(numericText);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function formatBudgetAmount(value: number) {
  return budgetAmountFormatter.format(value);
}
