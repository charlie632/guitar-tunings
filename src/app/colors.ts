import type { Degree } from "../theory";

export const degreeColor = (d: Degree | null): string => (d === null ? "var(--muted)" : `var(--deg-${d})`);
export const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];
