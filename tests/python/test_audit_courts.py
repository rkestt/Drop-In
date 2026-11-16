"""Test offline di scripts/audit_courts.py (#63).

Niente database: fixture in memoria + file temporanei. Si lancia con:

    python3 -m unittest discover -s tests/python -v

Casi coperti: normalizzazione, nomi generici, doppioni a <50 m, priorità,
ordinate stabili, batch, CSV/Markdown, errori di input.
"""

import csv
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import audit_courts as audit  # noqa: E402


def court(**kwargs):
    base = {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Campo Test",
        "lat": 41.9,
        "lng": 12.5,
        "address": None,
        "sport": None,
        "surface_type": None,
        "source": "osm",
        "osm_id": "node/1",
        "moderation_status": "approved",
    }
    base.update(kwargs)
    return audit.normalize(base)


class NormalizeTests(unittest.TestCase):
    def test_stringhe_numeriche_e_campi_mancanti(self):
        row = audit.normalize({"id": 1, "name": "  X  ", "lat": "41.9", "lng": None})
        self.assertEqual(row["id"], "1")
        self.assertEqual(row["name"], "X")
        self.assertEqual(row["lat"], 41.9)
        self.assertIsNone(row["lng"])

    def test_nomi_generici(self):
        for name in ["", "  ", "Spazio aperto", "Campo senza nome",
                     "Spazio aperto (Villa Borghese)", "campo", "abc"]:
            self.assertTrue(audit.is_generic_name(name), name)
        for name in ["Campo Roma Nord", "Playground dei Pini", "Campi Elisi"]:
            self.assertFalse(audit.is_generic_name(name), name)


class DuplicateTests(unittest.TestCase):
    def test_doppioni_entro_50_metri(self):
        a = court(id="a", lat=41.9000, lng=12.5000)
        b = court(id="b", lat=41.9002, lng=12.5000)  # ~22 m
        found = audit.find_duplicates([a, b])
        self.assertIn("a", found)
        self.assertIn("b", found)
        self.assertEqual(found["a"][0], "b")
        self.assertAlmostEqual(found["a"][2], 22.2, delta=1.0)

    def test_oltre_50_metri_non_e_doppione(self):
        a = court(id="a", lat=41.9000, lng=12.5000)
        b = court(id="b", lat=41.9010, lng=12.5000)  # ~111 m
        self.assertEqual(audit.find_duplicates([a, b]), {})

    def test_coordinate_mancanti_non_esplodono(self):
        a = court(id="a", lat=None, lng=None)
        self.assertEqual(audit.find_duplicates([a]), {})


class ClassifyTests(unittest.TestCase):
    def test_nome_generico_e_sport_null(self):
        score, flags = audit.classify(court(name="Spazio aperto"), None)
        self.assertGreaterEqual(score, 4)
        self.assertIn("nome generico", flags)
        self.assertIn("sport non specificato", flags)

    def test_fuori_italia_priorita_alta(self):
        score, flags = audit.classify(court(lat=48.8, lng=2.35), None)
        self.assertGreaterEqual(score, 3)
        self.assertIn("fuori Italia", flags)

    def test_fuori_roma_ma_in_italia(self):
        score, flags = audit.classify(court(lat=45.46, lng=9.19), None)
        self.assertEqual(score, 2)  # fuori Roma + sport null
        self.assertIn("fuori Roma", flags)

    def test_coordinate_zero(self):
        score, flags = audit.classify(court(lat=0.0, lng=0.0), None)
        self.assertGreaterEqual(score, 4)
        self.assertIn("coordinate 0,0", flags)

    def test_campo_normale_senza_segnali(self):
        score, flags = audit.classify(
            court(name="Campo Basket Prati", sport="basketball"), None
        )
        self.assertEqual(score, 0)
        self.assertEqual(flags, [])


class EnrichAndBatchTests(unittest.TestCase):
    def setUp(self):
        self.courts = [
            court(id="ok", name="Campo Basket Prati", sport="basketball"),
            court(id="generic", name="Spazio aperto", lat=41.91, lng=12.51),
            court(id="dup1", name="Campo Dup A", sport="basketball",
                  lat=41.92, lng=12.52),
            court(id="dup2", name="Campo Dup B", sport="basketball",
                  lat=41.9202, lng=12.52),
        ]

    def test_ordine_per_priorita_e_stabile(self):
        first = [c["id"] for c in audit.enrich(self.courts)]
        second = [c["id"] for c in audit.enrich(list(reversed(self.courts)))]
        self.assertEqual(first, second)
        self.assertEqual(first[0], "generic")
        self.assertIn("ok", first[1:])

    def test_batch_non_perdono_campi(self):
        enriched = audit.enrich(self.courts)
        batches = list(audit.chunks(enriched, 3))
        self.assertEqual(len(batches), 2)
        ids = [c["id"] for batch in batches for c in batch]
        self.assertCountEqual(ids, [c["id"] for c in self.courts])

    def test_link_mappa_costruiti(self):
        enriched = audit.enrich(self.courts)
        ok = next(c for c in enriched if c["id"] == "ok")
        self.assertIn("google.com/maps", ok["google_maps"])
        self.assertIn("41.900000,12.500000", ok["google_maps"])
        self.assertIn("openstreetmap.org", ok["osm_link"])


class OutputTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.courts = [
            court(id="aaaaaaaa-1111", name="Spazio aperto"),
            court(id="bbbbbbbb-2222", name="Campo Normale", sport="basketball"),
        ]

    def tearDown(self):
        self.tmp.cleanup()

    def test_csv_colonne_e_esito_vuoto(self):
        rows = audit.enrich(self.courts)[:1]
        path = self.dir / "batch-01.csv"
        audit.write_csv(rows, path, 1)
        with path.open(encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            self.assertEqual(reader.fieldnames, audit.CSV_COLUMNS)
            row = next(reader)
        self.assertEqual(row["batch"], "1")
        self.assertEqual(row["esito"], "")
        self.assertEqual(row["note"], "")
        self.assertIn("nome generico", row["flags"])
        self.assertTrue(row["id"].startswith("aaaaaaaa"))

    def test_markdown_contiene_link_e_segnali(self):
        rows = audit.enrich(self.courts)[:1]
        path = self.dir / "batch-01.md"
        audit.write_markdown(rows, path, 1, len(self.courts), "fixture")
        text = path.read_text(encoding="utf-8")
        self.assertIn("# Audit campi — batch 01", text)
        self.assertIn("openstreetmap.org", text)
        self.assertIn("nome generico", text)
        self.assertIn("`aaaaaaaa`", text)


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.json_path = self.dir / "courts.json"
        self.courts = [
            court(id=f"id-{i:03d}", name=f"Campo {i}", sport="basketball",
                  lat=41.90 + i * 0.001, lng=12.50)
            for i in range(7)
        ]
        # uno generico per avere priorita' alta in cima
        self.courts.append(court(id="generic", name="Spazio aperto"))
        self.json_path.write_text(json.dumps(self.courts), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            code = audit.main(list(args))
        return code, out.getvalue()

    def test_batch_singolo(self):
        code, log = self.run_cli(
            "--from-json", str(self.json_path), "--batch", "1",
            "--batch-size", "3", "--out", str(self.dir / "out"),
        )
        self.assertEqual(code, 0)
        self.assertIn("Batch 1/3", log)
        self.assertTrue((self.dir / "out" / "batch-01.csv").exists())

    def test_all_scrive_indice_e_tutti_i_batch(self):
        code, log = self.run_cli(
            "--from-json", str(self.json_path), "--all",
            "--batch-size", "4", "--out", str(self.dir / "out"),
        )
        self.assertEqual(code, 0)
        self.assertIn("2 batch", log)
        index = (self.dir / "out" / "index.md").read_text(encoding="utf-8")
        self.assertIn("Campi analizzati: 8", index)
        self.assertIn("Priorita' alta: 1", index)
        self.assertTrue((self.dir / "out" / "batch-02.md").exists())

    def test_summary_non_scrive_file(self):
        code, log = self.run_cli(
            "--from-json", str(self.json_path), "--summary",
            "--out", str(self.dir / "out"),
        )
        self.assertEqual(code, 0)
        self.assertIn("Campi: 8", log)
        self.assertFalse((self.dir / "out").exists())

    def test_batch_inesistente(self):
        with self.assertRaises(SystemExit):
            self.run_cli(
                "--from-json", str(self.json_path), "--batch", "99",
                "--out", str(self.dir / "out"),
            )


if __name__ == "__main__":
    unittest.main()
