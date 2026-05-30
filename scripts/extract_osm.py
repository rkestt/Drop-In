#!/usr/bin/env python3
"""
Extract sports fields and open spaces from OpenStreetMap using Overpass API.
Target area: Rome, Italy (all sports + green spaces).
"""

import json
import os
import sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query for all sports fields and open spaces in Rome
# Bounding box: entire Rome (41.75,12.30 to 41.98,12.65)
QUERY = """
[out:json][timeout:120];
(
  node["leisure"="pitch"](41.75,12.30,41.98,12.65);
  way["leisure"="pitch"](41.75,12.30,41.98,12.65);
  node["leisure"="park"](41.75,12.30,41.98,12.65);
  way["leisure"="park"](41.75,12.30,41.98,12.65);
  node["leisure"="playground"](41.75,12.30,41.98,12.65);
  way["leisure"="playground"](41.75,12.30,41.98,12.65);
  way["landuse"="recreation_ground"](41.75,12.30,41.98,12.65);
  way["landuse"="grass"](41.75,12.30,41.98,12.65);
);
out body;
>;
out skel qt;
"""

def fetch_osm_data():
    req = Request(
        OVERPASS_URL,
        data=urlencode({"data": QUERY}).encode("utf-8"),
        headers={"User-Agent": "Drop-In/1.0"},
    )
    with urlopen(req, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))

def parse_courts(data):
    nodes = {}
    venues = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            nodes[element["id"]] = (element["lat"], element["lon"])

    for element in data.get("elements", []):
        if element["type"] == "way":
            tags = element.get("tags", {})
            # Get center from nodes
            way_nodes = element.get("nodes", [])
            if not way_nodes:
                continue
            lats = []
            lons = []
            for nid in way_nodes:
                if nid in nodes:
                    lats.append(nodes[nid][0])
                    lons.append(nodes[nid][1])
            if not lats:
                continue
            lat = sum(lats) / len(lats)
            lon = sum(lons) / len(lons)

            # Determine venue type
            leisure = tags.get("leisure")
            landuse = tags.get("landuse")
            sports = tags.get("sport", "multi")
            
            if leisure == "pitch":
                venue_type = f"field_{sports}"
            elif leisure == "park":
                venue_type = "park"
            elif leisure == "playground":
                venue_type = "playground"
            elif landuse == "recreation_ground":
                venue_type = "recreation_ground"
            elif landuse == "grass":
                venue_type = "green_space"
            else:
                venue_type = "open_space"

            hoops = tags.get("hoops")
            venues.append({
                "osm_id": str(element["id"]),
                "name": tags.get("name", "Spazio aperto"),
                "address": tags.get("addr:street") or tags.get("addr:full") or None,
                "lat": lat,
                "lng": lon,
                "surface_type": tags.get("surface") or None,
                "venue_type": venue_type,
                "sport": sports if leisure == "pitch" else None,
                "access": tags.get("access") or None,
                "hoop_count": int(hoops) if hoops and hoops.isdigit() else None,
            })
        elif element["type"] == "node":
            tags = element.get("tags", {})
            
            # Determine venue type
            leisure = tags.get("leisure")
            
            if leisure in ["pitch", "park", "playground"]:
                sports = tags.get("sport", "multi")
                
                if leisure == "pitch":
                    venue_type = f"field_{sports}"
                elif leisure == "park":
                    venue_type = "park"
                else:
                    venue_type = "playground"
                
                hoops = tags.get("hoops")
                venues.append({
                    "osm_id": str(element["id"]),
                    "name": tags.get("name", "Spazio aperto"),
                    "address": tags.get("addr:street") or tags.get("addr:full") or None,
                    "lat": element["lat"],
                    "lng": element["lon"],
                    "surface_type": tags.get("surface") or None,
                    "venue_type": venue_type,
                    "sport": sports if leisure == "pitch" else None,
                    "access": tags.get("access") or None,
                    "hoop_count": int(hoops) if hoops and hoops.isdigit() else None,
                })

    return venues

def generate_sql(venues):
    lines = ["INSERT INTO courts (osm_id, name, address, lat, lng, surface_type, venue_type, sport, access, hoop_count) VALUES"]
    values = []
    for v in venues:
        values.append(
            f"    ('{v['osm_id']}', '{v['name'].replace(chr(39), chr(39)+chr(39))}', "
            f"{('NULL' if v['address'] is None else chr(39)+v['address'].replace(chr(39), chr(39)+chr(39))+chr(39))}, "
            f"{v['lat']}, {v['lng']}, "
            f"{('NULL' if v['surface_type'] is None else chr(39)+v['surface_type'].replace(chr(39), chr(39)+chr(39))+chr(39))}, "
            f"'{v['venue_type']}', "
            f"{('NULL' if v['sport'] is None else chr(39)+v['sport'].replace(chr(39), chr(39)+chr(39))+chr(39))}, "
            f"{('NULL' if v['access'] is None else chr(39)+v['access'].replace(chr(39), chr(39)+chr(39))+chr(39))}, "
            f"{'NULL' if v['hoop_count'] is None else v['hoop_count']})"
        )
    lines.append(",\n".join(values) + ";")
    return "\n".join(lines)

def main():
    print("Fetching OSM data...")
    data = fetch_osm_data()
    venues = parse_courts(data)
    print(f"Found {len(venues)} venues")

    os.makedirs("scripts", exist_ok=True)

    with open("scripts/courts.json", "w", encoding="utf-8") as f:
        json.dump(venues, f, indent=2, ensure_ascii=False)

    sql = generate_sql(venues)
    with open("scripts/seed_courts.sql", "w", encoding="utf-8") as f:
        f.write(sql)

    print("Wrote scripts/courts.json")
    print("Wrote scripts/seed_courts.sql")

if __name__ == "__main__":
    main()
