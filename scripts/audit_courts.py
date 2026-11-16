#!/usr/bin/env python3
"""Audit manuale dei campi esistenti, a batch da 50 (#63).

Genera per ogni batch un CSV compilabile (colonne `esito` e `note`) e un
markdown da leggere, con link Google Maps/OSM e i segnali di sospetto
ordinati per priorita'. Non scrive mai sul database: la decisione
(keep/remove/update/duplicate/unsure) la prende una persona.

Fonte dati (una delle due):
  --from-json FILE        export JSON (lista di oggetti) dal DB
  --supabase-url URL      REST API Supabase (anon key, sola lettura)

Esempi:
  python3 scripts/audit_courts.py --from-json courts.json --batch 1
  python3 scripts/audit_courts.py --supabase-url http://127.0.0.1:54321 \
      --anon-key "$ANON_KEY" --all --out docs/audit

Nessuna dipendenza esterna (solo stdlib): gira anche su una macchina senza
psycopg. La query REST e' paginata; l'anon key legge solo i campi approvati
(e' quello che serve: le proposte pending passano dalla moderazione).

Exit: 0 ok, 1 errore, 2 uso.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# BBox Roma usata dal seed OSM (scripts/extract_osm.py --bbox).
ROME_BBOX = (41.75, 12.30, 41.98, 12.65)  # south, west, north, east

# Nomi generici prodotti dall'estrazione automatica o dalle proposte senza
# nome: non identificano un campo, quindi vanno guardati per primi.
GENERIC_NAMES = {
    "spazio aperto",
    "campo senza nome",
    "campo sportivo",
    "campo",
    "campetto",
    "pitch",
    "sports field",
    "playground",
    "area giochi",
    "giardino",
}

DUPLICATE_RADIUS_M = 50.0
# L'Italia sta in questo rettangolo: coordinate fuori sono un errore di
# import o una corte estera importata per sbaglio.
ITALY_BBOX = (35.0, 6.0, 48.0, 19.0)

ESITO_VALUES = ("keep", "remove", "update", "duplicate", "unsure")


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distanza in metri (formula haversine, raggio medio terrestre)."""
    r = 6_371_008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _as_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize(raw: dict) -> dict:
    """Uniforma righe REST/JSON/export: solo i campi che servono."""
    lat = _as_float(raw.get("lat"))
    lng = _as_float(raw.get("lng"))
    return {
        "id": str(raw.get("id") or ""),
        "name": (raw.get("name") or "").strip(),
        "lat": lat,
        "lng": lng,
        "address": raw.get("address"),
        "sport": raw.get("sport"),
        "surface_type": raw.get("surface_type"),
        "source": raw.get("source"),
        "osm_id": raw.get("osm_id"),
        "moderation_status": raw.get("moderation_status"),
    }


def in_bbox(lat: float, lng: float, bbox) -> bool:
    south, west, north, east = bbox
    return south <= lat <= north and west <= lng <= east


def is_generic_name(name: str) -> bool:
    cleaned = name.strip().lower()
    if not cleaned or len(cleaned) < 4:
        return True
    if cleaned in GENERIC_NAMES:
        return True
    # "Spazio aperto (Villa Borghese)" e simili restano generici, ma solo le
    # formule multi-parola: "Campo Basket Prati" non e' "Campo".
    return any(
        " " in generic and cleaned.startswith(generic) for generic in GENERIC_NAMES
    )


def find_duplicates(courts: list[dict], radius_m: float = DUPLICATE_RADIUS_M) -> dict:
    """Mappa id -> (altro_id, altro_nome, distanza_m) per il vicino piu' prossimo.

    Griglia di celle ~55m: si confrontano solo le 9 celle attorno, non tutte
    le coppie (10k campi = 50M di coppie, troppo lento in Python puro).
    """
    cell = 0.0005
    buckets: dict[tuple[int, int], list[dict]] = {}
    for court in courts:
        lat, lng = court.get("lat"), court.get("lng")
        if lat is None or lng is None:
            continue
        key = (int(math.floor(lat / cell)), int(math.floor(lng / cell)))
        buckets.setdefault(key, []).append(court)

    result: dict[str, tuple[str, str, float]] = {}
    for court in courts:
        lat, lng = court.get("lat"), court.get("lng")
        if lat is None or lng is None:
            continue
        best = None
        cy, cx = int(math.floor(lat / cell)), int(math.floor(lng / cell))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for other in buckets.get((cy + dy, cx + dx), []):
                    if other["id"] == court["id"]:
                        continue
                    if other.get("lat") is None or other.get("lng") is None:
                        continue
                    dist = haversine_m(lat, lng, other["lat"], other["lng"])
                    if dist <= radius_m and (best is None or dist < best[2]):
                        best = (other["id"], other.get("name", ""), dist)
        if best:
            result[court["id"]] = best
    return result


def classify(court: dict, duplicate) -> tuple[int, list[str]]:
    """Punteggio di priorita' (piu' alto = guardare prima) e segnali."""
    score = 0
    flags: list[str] = []

    name = court.get("name", "")
    if not name:
        score += 4
        flags.append("nome vuoto")
    elif is_generic_name(name):
        score += 3
        flags.append("nome generico")

    lat, lng = court.get("lat"), court.get("lng")
    if lat is None or lng is None:
        score += 4
        flags.append("coordinate mancanti")
    elif abs(lat) < 1e-6 and abs(lng) < 1e-6:
        score += 4
        flags.append("coordinate 0,0")
    else:
        if not in_bbox(lat, lng, ITALY_BBOX):
            score += 3
            flags.append("fuori Italia")
        elif not in_bbox(lat, lng, ROME_BBOX):
            score += 1
            flags.append("fuori Roma")

    if duplicate:
        other_id, _other_name, dist = duplicate
        score += 2
        flags.append(f"duplicato? {dist:.0f}m da {other_id[:8]}")

    if not court.get("sport"):
        score += 1
        flags.append("sport non specificato")

    if court.get("source") == "community" and not court.get("osm_id"):
        flags.append("proposta community")

    return score, flags


def enrich(courts: list[dict]) -> list[dict]:
    duplicates = find_duplicates(courts)
    enriched = []
    for court in courts:
        duplicate = duplicates.get(court["id"])
        score, flags = classify(court, duplicate)
        lat, lng = court.get("lat"), court.get("lng")
        row = dict(court)
        row["score"] = score
        row["flags"] = flags
        row["flags_text"] = "; ".join(flags) if flags else ""
        row["duplicate_of"] = duplicate[0] if duplicate else ""
        row["distance_m"] = f"{duplicate[2]:.0f}" if duplicate else ""
        if lat is not None and lng is not None:
            row["google_maps"] = (
                f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lng:.6f}"
            )
            row["osm_link"] = (
                f"https://www.openstreetmap.org/?mlat={lat:.6f}"
                f"&mlon={lng:.6f}#map=18/{lat:.6f}/{lng:.6f}"
            )
        else:
            row["google_maps"] = ""
            row["osm_link"] = ""
        enriched.append(row)

    # Ordine stabile: priorita' decrescente, poi nome, poi id. Due run sugli
    # stessi dati producono gli stessi batch.
    enriched.sort(key=lambda c: (-c["score"], c.get("name", "").lower(), c["id"]))
    return enriched


CSV_COLUMNS = [
    "batch",
    "position",
    "id",
    "name",
    "lat",
    "lng",
    "address",
    "sport",
    "surface_type",
    "source",
    "osm_id",
    "priority",
    "flags",
    "duplicate_of",
    "distance_m",
    "google_maps",
    "osm_link",
    "esito",
    "note",
]


def priority_label(score: int) -> str:
    if score >= 5:
        return "alta"
    if score >= 3:
        return "media"
    if score >= 1:
        return "bassa"
    return "-"


def write_csv(rows: list[dict], path: Path, batch: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow(
                {
                    **{k: ("" if row.get(k) is None else row.get(k)) for k in CSV_COLUMNS},
                    "batch": batch,
                    "position": index,
                    "priority": priority_label(row["score"]),
                    "flags": row["flags_text"],
                    "esito": "",
                    "note": "",
                }
            )


def write_markdown(rows: list[dict], path: Path, batch: int, total: int, source: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Audit campi — batch {batch:02d}",
        "",
        f"Generato: {generated} · fonte: {source} · campi totali: {total} · "
        f"nel batch: {len(rows)}",
        "",
        "Compila `esito` (keep / remove / update / duplicate / unsure) e `note` "
        "nel CSV accanto; qui sotto la stessa lista in forma leggibile. "
        "Nessuna cancellazione automatica: le decisioni si applicano a mano "
        "(vedi `docs/audit-courts.md`).",
        "",
        "| # | id | nome | posizione | sport | segnali | esito |",
        "|---|---|---|---|---|---|---|",
    ]
    for index, row in enumerate(rows, start=1):
        name = row.get("name") or "—"
        if row.get("lat") is not None and row.get("lng") is not None:
            pos = (
                f"[{row['lat']:.5f}, {row['lng']:.5f}]({row['google_maps']}) · "
                f"[OSM]({row['osm_link']})"
            )
        else:
            pos = "—"
        flags = row["flags_text"] or "—"
        lines.append(
            f"| {index} | `{row['id'][:8]}` | {name} | {pos} | "
            f"{row.get('sport') or '—'} | {flags} |  |"
        )
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def chunks(items: list[dict], size: int):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def load_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        # export Supabase/psql: {"data": [...]} o {"rows": [...]}
        for key in ("data", "rows", "courts"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
    if not isinstance(data, list):
        raise ValueError(f"{path}: atteso un array JSON di campi")
    return [normalize(item) for item in data]


def load_supabase(url: str, anon_key: str, page_size: int = 1000) -> list[dict]:
    courts: list[dict] = []
    offset = 0
    base = url.rstrip("/")
    while True:
        query = urllib.parse.urlencode(
            {
                "select": "id,name,lat,lng,address,sport,surface_type,source,osm_id,moderation_status",
                "order": "id",
                "limit": page_size,
                "offset": offset,
            }
        )
        request = urllib.request.Request(
            f"{base}/rest/v1/courts?{query}",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                page = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise SystemExit(
                f"REST {error.code}: controlla URL/anon key (e che le corti siano approvate)"
            ) from error
        if not isinstance(page, list):
            raise SystemExit("Risposta REST inattesa (non è un array)")
        courts.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return [normalize(item) for item in courts]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit manuale dei campi a batch da 50 (#63). Nessuna scrittura sul DB."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--from-json", type=Path, help="export JSON dei campi")
    source.add_argument("--supabase-url", help="base URL Supabase (REST, sola lettura)")
    parser.add_argument("--anon-key", default=None, help="anon key (con --supabase-url)")
    parser.add_argument("--batch", type=int, default=1, help="numero batch (1-based)")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--all", action="store_true", help="scrive tutti i batch + index")
    parser.add_argument("--out", type=Path, default=Path("docs/audit"), help="cartella output")
    parser.add_argument("--summary", action="store_true", help="stampa solo le statistiche")
    args = parser.parse_args(argv)

    if args.batch < 1:
        parser.error("--batch e' 1-based")
    if args.batch_size < 1:
        parser.error("--batch-size deve essere >= 1")

    if args.from_json:
        courts = load_json(args.from_json)
        label = str(args.from_json)
    else:
        if not args.anon_key:
            parser.error("--anon-key obbligatoria con --supabase-url")
        courts = load_supabase(args.supabase_url, args.anon_key)
        label = f"{args.supabase_url} (anon, sola lettura)"

    if not courts:
        raise SystemExit("Nessun campo da analizzare")

    enriched = enrich(courts)
    batches = list(chunks(enriched, args.batch_size))
    stats = {label_: sum(1 for c in enriched if priority_label(c["score"]) == label_)
             for label_ in ("alta", "media", "bassa", "-")}

    if args.summary:
        print(f"Campi: {len(enriched)} · batch da {args.batch_size}: {len(batches)}")
        print(f"Priorita': alta {stats['alta']} · media {stats['media']} · "
              f"bassa {stats['bassa']} · nessun segnale {stats['-']}")
        return 0

    if args.all:
        for number, rows in enumerate(batches, start=1):
            write_csv(rows, args.out / f"batch-{number:02d}.csv", number)
            write_markdown(rows, args.out / f"batch-{number:02d}.md", number,
                           len(enriched), label)
        index = args.out / "index.md"
        index.parent.mkdir(parents=True, exist_ok=True)
        index.write_text(
            "\n".join(
                [
                    "# Audit campi — indice",
                    "",
                    f"Generato: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
                    f"fonte: {label}",
                    "",
                    f"- Campi analizzati: {len(enriched)}",
                    f"- Batch: {len(batches)} da {args.batch_size}",
                    f"- Priorita' alta: {stats['alta']} · media: {stats['media']} · "
                    f"bassa: {stats['bassa']} · senza segnali: {stats['-']}",
                    "",
                    "Procedura e criteri: `docs/audit-courts.md`.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        print(f"Scritti {len(batches)} batch in {args.out} (indice: {args.out / 'index.md'})")
        return 0

    if args.batch > len(batches):
        raise SystemExit(
            f"Batch {args.batch} inesistente: ce ne sono {len(batches)}"
        )
    rows = batches[args.batch - 1]
    csv_path = args.out / f"batch-{args.batch:02d}.csv"
    md_path = args.out / f"batch-{args.batch:02d}.md"
    write_csv(rows, csv_path, args.batch)
    write_markdown(rows, md_path, args.batch, len(enriched), label)
    print(f"Batch {args.batch}/{len(batches)}: {len(rows)} campi -> {csv_path}, {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
