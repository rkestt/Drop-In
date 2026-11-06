#!/usr/bin/env python3
"""Extract sports fields and open spaces from OpenStreetMap using the Overpass API.

General CLI: area via --bbox or --country/--city (Nominatim). Output goes to
--output (default scripts/generated/). See scripts/README.md.
"""

import argparse
import json
import os
import re
import sys
import time
from urllib.request import urlopen, Request
from urllib.parse import urlencode

DEFAULT_OVERPASS = "https://overpass-api.de/api/interpreter"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "Drop-In/1.0 (+https://github.com/rkestt/Drop-In)"
DEFAULT_NAME = "Spazio aperto"


def slugify_area(args):
    if not args.bbox and not args.country and not args.city:
        p.error("provide --bbox or --city (optionally with --country)")
    if args.bbox:
        s, w, n, e = args.bbox
        return f"bbox-{s}_{w}_{n}_{e}".replace(".", "_")
    if args.country and args.city:
        return f"country-{args.country.lower()}-city-{args.city.lower().replace(' ', '-')}"
    if args.country:
        return f"country-{args.country.lower()}"
    return "area"


def resolve_bbox_country_city(country, city):
    params = {"format": "jsonv2", "limit": 1}
    if city and country:
        params["q"] = f"{city}, {country}"
        params["countrycodes"] = country.lower()
    elif city:
        params["q"] = city
    else:
        params["country"] = country
    url = f"{NOMINATIM}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data:
        raise SystemExit(f"Nominatim: area not found ({country} / {city})")
    bb = data[0]["boundingbox"]  # [south, north, west, east]
    return float(bb[0]), float(bb[2]), float(bb[1]), float(bb[3])


def fetch_osm_data(bbox, endpoint):
    s, w, n, e = bbox
    query = f"""
[out:json][timeout:120];
(
  node["leisure"="pitch"]({s},{w},{n},{e});
  way["leisure"="pitch"]({s},{w},{n},{e});
  node["leisure"="park"]({s},{w},{n},{e});
  way["leisure"="park"]({s},{w},{n},{e});
  node["leisure"="playground"]({s},{w},{n},{e});
  way["leisure"="playground"]({s},{w},{n},{e});
  way["landuse"="recreation_ground"]({s},{w},{n},{e});
  way["landuse"="grass"]({s},{w},{n},{e});
);
out body;
>;
out skel qt;
"""
    data = urlencode({"data": query}).encode("utf-8")
    for attempt in range(2):
        try:
            req = Request(endpoint, data=data, headers={"User-Agent": UA})
            with urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == 0:
                time.sleep(2)
                continue
            raise SystemExit(
                f"Overpass request failed: {exc}. Try a mirror: "
                "https://overpass.kumi.systems/api/interpreter (use --endpoint)"
            )
    raise SystemExit("Overpass request failed")


def parse_courts(data):
    nodes = {}
    venues = []
    for element in data.get("elements", []):
        if element["type"] == "node":
            nodes[element["id"]] = (element["lat"], element["lon"])

    def add(tags, lat, lng, osm_id, is_pitch_leisure):
        leisure = tags.get("leisure")
        landuse = tags.get("landuse")
        raw_sport = tags.get("sport")
        if leisure == "pitch":
            sport = raw_sport  # None if absent; 'multi' only if OSM says so
            if raw_sport:
                venue_type = f"field_{raw_sport}"
            else:
                venue_type = "field_unknown"
        elif leisure == "park":
            venue_type = "park"
            sport = None
        elif leisure == "playground":
            venue_type = "playground"
            sport = None
        elif landuse == "recreation_ground":
            venue_type = "recreation_ground"
            sport = None
        elif landuse == "grass":
            venue_type = "green_space"
            sport = None
        else:
            venue_type = "open_space"
            sport = None
        name = tags.get("name") or DEFAULT_NAME
        address = tags.get("addr:street") or tags.get("addr:full")
        venues.append({
            "osm_id": str(osm_id),
            "name": name,
            "address": address,
            "lat": lat,
            "lng": lng,
            "surface_type": tags.get("surface"),
            "venue_type": venue_type,
            "sport": sport,
        })

    for element in data.get("elements", []):
        if element["type"] == "way":
            tags = element.get("tags", {})
            way_nodes = element.get("nodes", [])
            lats, lons = [], []
            for nid in way_nodes:
                if nid in nodes:
                    lats.append(nodes[nid][0]); lons.append(nodes[nid][1])
            if not lats:
                continue
            add(tags, sum(lats)/len(lats), sum(lons)/len(lons), element["id"], tags.get("leisure") == "pitch")
        elif element["type"] == "node":
            tags = element.get("tags", {})
            if tags.get("leisure") in ("pitch", "park", "playground"):
                add(tags, element["lat"], element["lon"], element["id"], tags.get("leisure") == "pitch")
    return venues


def esc(s):
    if s is None:
        return None
    s = str(s)
    # strip control chars except newline/tab? brief: strip control chars; guard backslash/newline
    s = "".join(ch for ch in s if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    s = s.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
    s = s.replace("'", "''")
    return s


def sql_val(v):
    if v is None:
        return "NULL"
    return f"'{esc(v)}'"


def generate_sql(venues, upsert=False):
    cols = "osm_id, name, address, lat, lng, surface_type, venue_type, sport, source, moderation_status"
    header = f"INSERT INTO courts ({cols}) VALUES"
    rows = []
    for v in venues:
        vals = [
            sql_val(v["osm_id"]),
            sql_val(v["name"]),
            sql_val(v["address"]),
            str(v["lat"]),
            str(v["lng"]),
            sql_val(v["surface_type"]),
            sql_val(v["venue_type"]),
            sql_val(v["sport"]),
            "'osm'",
            "'approved'",
        ]
        # name default handling: COALESCE on upsert
        if upsert:
            vals[1] = f"COALESCE(NULLIF({sql_val(v['name'])}, 'Spazio aperto'), courts.name)"  # not valid in VALUES; revert below
        rows.append("    (" + ", ".join(vals) + ")")
    body = ",\n".join(rows) + ";"
    if not upsert:
        return f"{header}\n{body}"
    # redo name properly: use EXCLUDED semantics in ON CONFLICT, name value stays plain in VALUES
    rows = []
    for v in venues:
        vals = [
            sql_val(v["osm_id"]), sql_val(v["name"]), sql_val(v["address"]),
            str(v["lat"]), str(v["lng"]), sql_val(v["surface_type"]),
            sql_val(v["venue_type"]), sql_val(v["sport"]), "'osm'", "'approved'",
        ]
        rows.append("    (" + ", ".join(vals) + ")")
    body = ",\n".join(rows)
    sql = (
        f"{header}\n{body}\n"
        "ON CONFLICT (osm_id) DO UPDATE SET\n"
        "    name = COALESCE(NULLIF(EXCLUDED.name, 'Spazio aperto'), courts.name),\n"
        "    address = EXCLUDED.address,\n"
        "    lat = EXCLUDED.lat,\n"
        "    lng = EXCLUDED.lng,\n"
        "    surface_type = EXCLUDED.surface_type,\n"
        "    venue_type = EXCLUDED.venue_type,\n"
        "    sport = COALESCE(EXCLUDED.sport, courts.sport);"
    )
    return sql


def main():
    p = argparse.ArgumentParser(
        description="Extract OSM sports fields/open spaces to SQL + JSON.",
        epilog=(
            "Examples:\n"
            "  python3 scripts/extract_osm.py --bbox 41.7,12.3,41.9,12.6 --dry-run\n"
            "  python3 scripts/extract_osm.py --country IT --city Milan\n"
            "  python3 scripts/extract_osm.py --bbox 41.7,12.3,41.9,12.6 --sport basketball --upsert-sql\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    grp = p.add_mutually_exclusive_group(required=False)
    grp.add_argument("--bbox", help="S,W,N,E floats")
    grp.add_argument("--country", help="ISO2 country code")
    grp.add_argument("--city", help="city name (standalone or with --country)")
    p.add_argument("--sport", help="filter by sport (keeps multi and untagged)")
    p.add_argument("--output", default="scripts/generated/")
    p.add_argument("--out-name", dest="out_name", default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--upsert-sql", action="store_true")
    p.add_argument("--endpoint", default=DEFAULT_OVERPASS)

    args = p.parse_args()

    if not args.bbox and not args.country and not args.city:
        p.error("provide --bbox or --city (optionally with --country)")
    if args.bbox:
        parts = [x.strip() for x in args.bbox.split(",")]
        if len(parts) != 4:
            p.error("--bbox must be S,W,N,E")
        try:
            s, w, n, e = [float(x) for x in parts]
        except ValueError:
            p.error("--bbox values must be floats")
        if not (s < n and w < e):
            p.error("--bbox requires s<n and w<e")
        bbox = (s, w, n, e)
        area_slug = f"bbox-{s}_{w}_{n}_{e}".replace(".", "_")
    else:
        if args.city or args.country:
            time.sleep(1)
        s, w, n, e = resolve_bbox_country_city(args.country, args.city)
        bbox = (s, w, n, e)
        if args.city and args.country:
            area_slug = f"country-{args.country.lower()}-city-{args.city.lower().replace(' ', '-')}"
        elif args.city:
            area_slug = f"city-{args.city.lower().replace(' ', '-')}"
        else:
            area_slug = f"country-{args.country.lower()}"

    if args.out_name:
        out_name = args.out_name
    else:
        out_name = area_slug

    print("Fetching OSM data...")
    data = fetch_osm_data(bbox, args.endpoint)
    venues = parse_courts(data)

    # parks/playgrounds/open spaces with no sport tag -> multi already handled in parse.
    # sport filter
    if args.sport:
        sfilter = args.sport
        venues = [v for v in venues if v["sport"] == sfilter or v["sport"] == "multi" or v["sport"] is None]

    # counts
    from collections import Counter
    vt = Counter(v["venue_type"] for v in venues)
    sp = Counter(v["sport"] for v in venues)
    print(f"Found {len(venues)} venues")
    print("By venue_type:", dict(vt))
    print("By sport:", dict(sp))

    sql = generate_sql(venues, upsert=args.upsert_sql)

    if args.dry_run:
        print("--- sample SQL (first 5 value rows) ---")
        lines = sql.splitlines()
        # print header + first 5 rows
        print("\n".join(lines[:7]))
        return

    out_dir = args.output
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, f"{out_name}.json")
    sql_path = os.path.join(out_dir, f"{out_name}.sql")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(venues, f, indent=2, ensure_ascii=False)
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"Wrote {json_path}")
    print(f"Wrote {sql_path}")


if __name__ == "__main__":
    main()
