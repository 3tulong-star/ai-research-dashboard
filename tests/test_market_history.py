import importlib.util
import unittest
from datetime import date, timedelta
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "scripts" / "collect_market_history.py"
SPEC = importlib.util.spec_from_file_location("collect_market_history", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

class MarketHistoryTest(unittest.TestCase):
    def rows(self, count: int):
        end = date(2026, 7, 20)
        return [{"date": (end - timedelta(days=count-index-1)).isoformat(), "close": "90" if index == count-1 else "100", "tradestatus": "1", "peTTM": str(10+index/100), "pbMRQ": "2", "psTTM": "3"} for index in range(count)]

    def test_computes_real_history_metrics(self):
        metrics = MODULE.compute_metrics(self.rows(600), "2026-07-21")
        self.assertTrue(metrics["dataComplete"])
        self.assertEqual(metrics["valuationMetric"], "PE-TTM")
        self.assertEqual(metrics["valuationHistoryCount"], 600)
        self.assertEqual(metrics["valuationPercentile"], 99.92)
        self.assertEqual(metrics["drawdown52wPct"], -10.0)
        self.assertEqual(metrics["change60dPct"], -10.0)
        self.assertEqual(metrics["change252dPct"], -10.0)
        self.assertGreater(metrics["volatilityAnnualizedPct"], 0)
        self.assertEqual(metrics["priceHistoryCount"], 252)

    def test_missing_history_never_becomes_zero(self):
        metrics = MODULE.compute_metrics(self.rows(100), "2026-07-21")
        self.assertFalse(metrics["dataComplete"])
        self.assertIsNone(metrics["valuationPercentile"])
        self.assertIsNone(metrics["drawdown52wPct"])

if __name__ == "__main__":
    unittest.main()
