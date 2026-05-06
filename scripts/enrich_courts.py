#!/usr/bin/env python3
"""
Reverse geocoding recovery script.
Resumes from previous run, saves every 10 courts.
"""

import json
import time
import os
from urllib.request import urlopen, Request
from urllib.parse import urlencode

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "Drop-In/1.0 (basketball court enrichment)"
OUTFILE = "scripts/courts.json"

def reverse_geocode(lat: float, lon: float) -> str | None:
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
    }
    req = Request(
        f"{NOMINATIM_URL}?{urlencode(params)}",
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            addr = data.get("address", {})
            road = addr.get("road") or addr.get("footway") or addr.get("path") or ""
            house = addr.get("house_number") or ""
            suburb = addr.get("suburb") or addr.get("neighbourhood") or ""
            city = addr.get("city") or addr.get("town") or addr.get("municipality") or addr.get("village") or ""
            parts = []
            if house and road:
                parts.append(f"{road} {house}".strip())
            elif road:
                parts.append(road)
            if suburb and suburb != city:
                parts.append(suburb)
            if city:
                parts.append(city)
            return ", ".join(parts) if parts else None
    except Exception as e:
        return None

def save(courts):
    with open(OUTFILE, "w", encoding="utf-8") as f:
        json.dump(courts, f, indent=2, ensure_ascii=False)

def main():
    with open(OUTFILE, "r", encoding="utf-8") as f:
        courts = json.load(f)

    bk_courts = [c for c in courts if c.get("sport") == "basketball"]
    need_geo = [c for c in bk_courts if not c.get("address")]
    total = len(need_geo)
    print(f"Basketball courts needing geocoding: {total}")

    updated = 0
    for i, court in enumerate(need_geo, 1):
        lat, lng = court["lat"], court["lng"]
        addr = reverse_geocode(lat, lng)
        if addr:
            court["address"] = addr
            court["name"] = addr.split(",")[0]
            updated += 1
            print(f"  [{i}/{total}] OK: {addr[:60]}")
        else:
            print(f"  [{i}/{total}] FAIL")
        # Save every 10 courts
        if i % 10 == 0:
            save(courts)
            print(f"  >> Saved progress ({i}/{total})")
        time.sleep(1.1)

    save(courts)
    print(f"\nDone. Enriched {updated}/{total} courts.")
    with_addr = [c for c in bk_courts if c.get("address")]
    print(f"Total basketball courts with address: {len(with_addr)}/{len(bk_courts)}")
    for c in with_addr[:8]:
        print(f"  {c.get('name')} | {c.get('address')} | {c.get('surface_type')}")

if __name__ == "__main__":
    main()
