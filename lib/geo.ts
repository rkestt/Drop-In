export interface BBox {
  n: number;
  s: number;
  e: number;
  w: number;
}

/** True when bbox `a` is fully contained within bbox `b`. */
export function bboxInside(a: BBox, b: BBox): boolean {
  return a.s >= b.s && a.n <= b.n && a.w >= b.w && a.e <= b.e;
}
