export type LiquidityRow = { key: string; demand: number; supply: number; ratio: number | null; flag: "undersupplied" | "oversupplied" | "balanced" | "thin" };

/**
 * demand = open campaigns (+ active brands seeking that segment); supply = published creator profiles.
 * Thresholds are starting points for operators, not benchmarks.
 */
export function liquidityTable(demand: Record<string, number>, supply: Record<string, number>): LiquidityRow[] {
  const keys = new Set([...Object.keys(demand), ...Object.keys(supply)]);
  return [...keys]
    .map((key) => {
      const dm = demand[key] ?? 0;
      const sp = supply[key] ?? 0;
      const ratio = sp ? dm / sp : null;
      let flag: LiquidityRow["flag"] = "balanced";
      if (dm + sp < 3) flag = "thin";
      else if (sp === 0 || (ratio !== null && ratio > 1.5)) flag = "undersupplied";
      else if (dm === 0 || (ratio !== null && ratio < 0.2)) flag = "oversupplied";
      return { key, demand: dm, supply: sp, ratio, flag };
    })
    .sort((a, b) => b.demand + b.supply - (a.demand + a.supply));
}

export function countBy<T>(rows: T[], keys: (r: T) => (string | null | undefined)[]) {
  const out: Record<string, number> = {};
  for (const r of rows) for (const k of new Set(keys(r).filter(Boolean) as string[])) out[k] = (out[k] ?? 0) + 1;
  return out;
}
