/**
 * Guardie per i filtri degli stili MapLibre (#79).
 *
 * Lo stile upstream OpenFreeMap Liberty contiene confronti d'ordine su
 * proprieta' non tipizzate, es. `poi_r20`:
 *
 *   ["all",
 *     ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
 *     [">=", ["get", "rank"], 20]]
 *
 * (stessa forma per `poi_r7`, `poi_r1` su `rank`, gli highway shield su
 * `ref_length` e `label_country_3` su `rank`). Le feature senza la
 * proprieta' valutano `["get", ...]` a null e MapLibre logga in console
 * `Expected value to be of type number, but found null instead.`
 * (stringa emessa solo da `Assertion.evaluate`, iniettata per i confronti
 * d'ordine con operando sinistro non tipizzato).
 *
 * La guardia riscrive ogni confronto d'ordine il cui operando e'
 * `["get", prop]` in:
 *
 *   ["all", ["!=", ["typeof", ["get", prop]], "null"], <originale>]
 *
 * cosi' le feature senza la proprieta' escono dal filtro prima del
 * confronto e il warning sparisce. Idempotente: un secondo passaggio non
 * cambia nulla. Tutto il resto resta intatto.
 */

const ORDER_OPS: ReadonlySet<string> = new Set(["<", "<=", ">", ">="]);

/** True se `node` e' `["get", "<prop>"]`. */
function isGetProp(node: unknown): node is [string, string] {
  return (
    Array.isArray(node) &&
    node.length === 2 &&
    node[0] === "get" &&
    typeof node[1] === "string"
  );
}

/**
 * True se `node` e' la guardia `["!=", ["typeof", ["get", prop]], "null"]`
 * per `prop`. Ritorna la prop guardata oppure null.
 */
function guardedProp(node: unknown): string | null {
  if (!Array.isArray(node) || node.length !== 3) return null;
  const [op, lhs, rhs] = node;
  if (op !== "!=" || rhs !== "null") return null;
  if (!Array.isArray(lhs) || lhs.length !== 2) return null;
  const [typeofOp, getExpr] = lhs;
  if (typeofOp !== "typeof") return null;
  if (!isGetProp(getExpr)) return null;
  return getExpr[1];
}

/** True se `node` e' un confronto d'ordine su `["get", prop]`. */
function isUnguardedOrderComparison(
  node: unknown,
  excluded: ReadonlySet<string>
): node is [string, [string, string], unknown] {
  if (!Array.isArray(node) || node.length !== 3) return false;
  const [op, lhs] = node;
  if (typeof op !== "string" || !ORDER_OPS.has(op)) return false;
  if (!isGetProp(lhs)) return false;
  return !excluded.has(lhs[1]);
}

function guardNode(node: unknown, excluded: ReadonlySet<string>): unknown {
  if (!Array.isArray(node)) return node;
  const [head, ...rest] = node;
  if (head === "all" || head === "any" || head === "none") {
    // Le prop gia' guardate da un typeof-check diretto in questo nodo non
    // vanno riavvolte: cosi' il secondo passaggio e' un no-op.
    const local = new Set<string>(excluded);
    for (const child of rest) {
      const prop = guardedProp(child);
      if (prop !== null) local.add(prop);
    }
    let changed = false;
    const guarded = rest.map((child) => {
      const next = guardNode(child, local);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? [head, ...guarded] : node;
  }
  if (isUnguardedOrderComparison(node, excluded)) {
    const prop = (node[1] as [string, string])[1];
    return [
      "all",
      ["!=", ["typeof", ["get", prop]], "null"],
      node,
    ];
  }
  let changed = false;
  const mapped = node.map((child) => {
    if (!Array.isArray(child)) return child;
    const next = guardNode(child, excluded);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? mapped : node;
}

/** Applica la guardia a un filtro di stile. Non muta l'input. */
export function guardFilter(filter: unknown): unknown {
  return guardNode(filter, new Set());
}

/** Forma minima di layer che serve alla guardia. */
export interface GuardableLayer {
  id: string;
  filter?: unknown;
}

/**
 * Applica `guardFilter` ai filtri di tutti i layer e ritorna solo quelli
 * cambiati (confronto JSON), pronti per `map.setFilter(id, filter)`.
 */
export function guardStyleLayersFilter<T extends GuardableLayer>(
  layers: ReadonlyArray<T> | null | undefined
): Array<{ id: string; filter: unknown }> {
  if (!layers) return [];
  const changed: Array<{ id: string; filter: unknown }> = [];
  for (const layer of layers) {
    if (layer.filter == null) continue;
    const guarded = guardFilter(layer.filter);
    if (JSON.stringify(guarded) !== JSON.stringify(layer.filter)) {
      changed.push({ id: layer.id, filter: guarded });
    }
  }
  return changed;
}
