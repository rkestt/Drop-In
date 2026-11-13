import { describe, expect, it } from "vitest";
import { guardFilter, guardStyleLayersFilter } from "@/lib/map/style-guards";

describe("guardFilter", () => {
  it("avvolge il confronto su rank di poi_r20 (forma reale Liberty)", () => {
    const filter = [
      "all",
      ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
      [">=", ["get", "rank"], 20],
    ];
    expect(guardFilter(filter)).toEqual([
      "all",
      ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
      ["all", ["!=", ["typeof", ["get", "rank"]], "null"], [">=", ["get", "rank"], 20]],
    ]);
  });

  it("avvolge il confronto su admin_level (boundary_3 non guardato)", () => {
    const filter = ["all", [">=", ["get", "admin_level"], 3], ["<=", ["get", "admin_level"], 6]];
    expect(guardFilter(filter)).toEqual([
      "all",
      ["all", ["!=", ["typeof", ["get", "admin_level"]], "null"], [">=", ["get", "admin_level"], 3]],
      ["all", ["!=", ["typeof", ["get", "admin_level"]], "null"], ["<=", ["get", "admin_level"], 6]],
    ]);
  });

  it("guardia typeof diversa (boundary_3 reale) resta intatta, secondo passaggio no-op", () => {
    const filter = [
      "all",
      ["==", ["typeof", ["get", "admin_level"]], "number"],
      [">=", ["get", "admin_level"], 3],
    ];
    // ["==", typeof, "number"] non e' la guardia "!=" / "null": il confronto
    // viene avvolto, ma la guardia esistente resta intatta.
    const once = guardFilter(filter);
    expect(guardNodeTwice(once)).toEqual(once);
  });

  it("doppio passaggio = no-op (idempotente)", () => {
    const filter = [
      "all",
      ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
      [">=", ["get", "rank"], 7],
      ["<", ["get", "rank"], 20],
    ];
    const once = guardFilter(filter) as unknown[];
    expect(guardFilter(once)).toEqual(once);
  });

  it("non tocca i filtri senza confronti d'ordine", () => {
    const filter = ["==", ["get", "class"], "residential"];
    expect(guardFilter(filter)).toBe(filter);
    const match = ["match", ["get", "class"], ["service", "track"], true, false];
    expect(guardFilter(match)).toBe(match);
  });

  it("confronto tra letterali numerici resta intatto", () => {
    const filter = [">=", 3, 2];
    expect(guardFilter(filter)).toBe(filter);
  });

  it("gestisce any annidati", () => {
    const filter = ["any", [">=", ["get", "rank"], 1], ["==", ["get", "class"], "x"]];
    expect(guardFilter(filter)).toEqual([
      "any",
      ["all", ["!=", ["typeof", ["get", "rank"]], "null"], [">=", ["get", "rank"], 1]],
      ["==", ["get", "class"], "x"],
    ]);
  });

  it("non muta l'input", () => {
    const inner: unknown[] = [">=", ["get", "rank"], 20];
    const filter = ["all", inner];
    guardFilter(filter);
    expect(inner).toEqual([">=", ["get", "rank"], 20]);
    expect(filter).toEqual(["all", inner]);
  });

  it("input non filtro passano invariati", () => {
    expect(guardFilter(null)).toBeNull();
    expect(guardFilter(undefined)).toBeUndefined();
    expect(guardFilter("all")).toBe("all");
  });
});

describe("guardStyleLayersFilter", () => {
  it("ritorna solo i layer cambiati", () => {
    const changed = guardStyleLayersFilter([
      { id: "poi_r20", filter: [">=", ["get", "rank"], 20] },
      { id: "water", filter: ["!=", ["get", "brunnel"], "tunnel"] },
      { id: "nodel", type: "background" },
    ]);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.id).toBe("poi_r20");
  });

  it("layer null/undefined = lista vuota", () => {
    expect(guardStyleLayersFilter(null)).toEqual([]);
    expect(guardStyleLayersFilter(undefined)).toEqual([]);
  });
});

function guardNodeTwice(node: unknown): unknown {
  return guardFilter(guardFilter(node));
}
