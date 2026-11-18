"""Test offline di scripts/extract_osm.py (lane B #106).

Niente rete, niente database: payload Overpass sintetici in memoria.
Si lancia con:

    python3 -m unittest discover -s tests/python -v

Casi coperti: mapping venue_type -> nome generico (stesso della decisione
#106), flag is_auto_name nel parse, upsert che non sovrascrive i nomi veri
e flag che segue il nome che resta.
"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import extract_osm as ext  # noqa: E402


def node(osm_id, tags, lat=41.9, lng=12.5):
    return {
        "type": "node", "id": osm_id, "lat": lat, "lon": lng, "tags": tags,
    }


class GenericNameTests(unittest.TestCase):
    def test_mapping_decisione_106(self):
        self.assertEqual(ext.generic_name_for_venue("field_basketball"), "Campo")
        self.assertEqual(ext.generic_name_for_venue("field_unknown"), "Campo")
        self.assertEqual(ext.generic_name_for_venue("park"), "Parco")
        self.assertEqual(ext.generic_name_for_venue("playground"), "Parco giochi")
        self.assertEqual(
            ext.generic_name_for_venue("recreation_ground"), "Area ricreativa")
        self.assertEqual(ext.generic_name_for_venue("green_space"), "Spazio verde")

    def test_fallback_campo(self):
        for vt in (None, "", "open_space", "qualcosa_di_nuovo"):
            self.assertEqual(ext.generic_name_for_venue(vt), "Campo", vt)
        self.assertEqual(ext.DEFAULT_NAME, "Campo")


class ParseFlagTests(unittest.TestCase):
    def test_senza_nome_generico_e_flag_vero(self):
        venues = ext.parse_courts({"elements": [
            node(1, {"leisure": "park"}),
        ]})
        self.assertEqual(len(venues), 1)
        self.assertEqual(venues[0]["name"], "Parco")
        self.assertTrue(venues[0]["is_auto_name"])

    def test_nome_osm_vero_resta_e_flag_falso(self):
        venues = ext.parse_courts({"elements": [
            node(2, {"leisure": "pitch", "sport": "basketball",
                     "name": "Playground dei Pini"}),
        ]})
        self.assertEqual(venues[0]["name"], "Playground dei Pini")
        self.assertFalse(venues[0]["is_auto_name"])
        self.assertEqual(venues[0]["venue_type"], "field_basketball")

    def test_nome_vuoto_vale_come_assente(self):
        venues = ext.parse_courts({"elements": [
            node(3, {"leisure": "playground", "name": ""}),
        ]})
        self.assertEqual(venues[0]["name"], "Parco giochi")
        self.assertTrue(venues[0]["is_auto_name"])


class UpsertTests(unittest.TestCase):
    def test_insert_porta_il_flag(self):
        venues = ext.parse_courts({"elements": [
            node(1, {"leisure": "park"}),
            node(2, {"leisure": "pitch", "sport": "basketball",
                     "name": "Campo Vero"}),
        ]})
        sql = ext.generate_sql(venues, upsert=False)
        self.assertIn("is_auto_name", sql.split("VALUES")[0])
        self.assertIn("'Parco', TRUE", sql)
        self.assertIn("'Campo Vero', FALSE", sql)

    def test_upsert_flag_segue_il_nome_che_resta(self):
        venues = ext.parse_courts({"elements": [
            node(1, {"leisure": "park"}),
        ]})
        sql = ext.generate_sql(venues, upsert=True)
        # generico in import non sovrascrive un nome vero a DB...
        self.assertIn(
            "name = CASE WHEN (NOT EXCLUDED.is_auto_name)"
            " OR courts.is_auto_name THEN EXCLUDED.name"
            " ELSE courts.name END",
            sql,
        )
        # ...e il flag segue il nome che resta
        self.assertIn(
            "is_auto_name = CASE WHEN NOT EXCLUDED.is_auto_name"
            " THEN FALSE ELSE courts.is_auto_name END",
            sql,
        )
        self.assertNotIn("Spazio aperto", sql)


if __name__ == "__main__":
    unittest.main()
