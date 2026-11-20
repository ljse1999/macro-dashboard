export interface TreemapInput {
  id: string;
  weight: number;
}

export interface TreemapRect<T extends TreemapInput> {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes a clean recursive binary slice-and-dice / balanced aspect-ratio treemap
 * inside a bounding box of (width x height) in coordinate units (e.g. 0..100).
 */
export function computeTreemap<T extends TreemapInput>(
  items: T[],
  width = 100,
  height = 100
): TreemapRect<T>[] {
  const valid = items
    .filter((i) => Number.isFinite(i.weight) && i.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (valid.length === 0 || width <= 0 || height <= 0) return [];

  const result: TreemapRect<T>[] = [];

  function layout(subset: T[], x: number, y: number, w: number, h: number) {
    if (subset.length === 0) return;
    if (subset.length === 1) {
      result.push({ item: subset[0], x, y, width: w, height: h });
      return;
    }

    const total = subset.reduce((s, item) => s + item.weight, 0);
    // Split subset into two balanced halves by cumulative weight
    let halfSum = 0;
    let splitIdx = 1;
    for (let i = 0; i < subset.length - 1; i++) {
      halfSum += subset[i].weight;
      splitIdx = i + 1;
      if (halfSum >= total / 2) break;
    }

    const first = subset.slice(0, splitIdx);
    const second = subset.slice(splitIdx);
    const firstRatio = first.reduce((s, item) => s + item.weight, 0) / total;

    if (w >= h) {
      const w1 = w * firstRatio;
      layout(first, x, y, w1, h);
      layout(second, x + w1, y, w - w1, h);
    } else {
      const h1 = h * firstRatio;
      layout(first, x, y, w, h1);
      layout(second, x, y + h1, w, h - h1);
    }
  }

  layout(valid, 0, 0, width, height);
  return result;
}
