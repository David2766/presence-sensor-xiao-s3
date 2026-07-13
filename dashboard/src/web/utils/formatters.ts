export interface FormatBytesOptions {
  invalidText?: string;
  nonPositiveText?: string;
  minUnit?: "B" | "KB";
  unitSeparator?: string;
  kbPrecision?: number | "round";
  mbPrecision?: number;
  clampNegative?: boolean;
}

export function formatBytes(value: number | null | undefined, options: FormatBytesOptions = {}): string {
  const invalidText = options.invalidText ?? "-";
  if (!Number.isFinite(value ?? NaN)) return invalidText;

  let bytes = Number(value);
  if (options.clampNegative) bytes = Math.max(0, bytes);
  if (options.nonPositiveText !== undefined && bytes <= 0) return options.nonPositiveText;

  const unitSeparator = options.unitSeparator ?? "";
  const minUnit = options.minUnit ?? "B";

  if (bytes < 1024 && minUnit === "B") {
    return `${Math.round(bytes)}${unitSeparator}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${formatUnitValue(bytes / 1024, options.kbPrecision ?? "round")}${unitSeparator}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(options.mbPrecision ?? 1)}${unitSeparator}MB`;
}

export function formatCompactBytes(value: number | null | undefined): string {
  return formatBytes(value, {
    clampNegative: true
  });
}

function formatUnitValue(value: number, precision: number | "round"): string {
  if (precision === "round") return String(Math.round(value));
  return value.toFixed(precision);
}
