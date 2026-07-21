#!/usr/bin/env python3
"""Collect auditable five-year valuation history and 252-day price drawdown.

Missing or stale observations remain missing. They are never converted to zero.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


FIELDS = "date,code,close,tradestatus,peTTM,pbMRQ,psTTM,isST"
MIN_VALUATION_OBSERVATIONS = 500
MIN_PRICE_OBSERVATIONS = 200
PRICE_WINDOW = 252
SOURCE_URL = "https://pypi.org/project/baostock/"


def number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else None
    except (TypeError, ValueError):
        return None


def percentile_rank(values: list[float], current: float) -> float:
    below = sum(value < current for value in values)
    equal = sum(value == current for value in values)
    return round((below + 0.5 * equal) / len(values) * 100, 2)


def compute_metrics(rows: list[dict[str, Any]], requested_as_of: str) -> dict[str, Any]:
    valid = [row for row in rows if str(row.get("tradestatus", "1")) == "1" and (number(row.get("close")) or 0) > 0]
    valid.sort(key=lambda row: str(row.get("date", "")))
    if not valid:
        return {"dataComplete": False, "error": "no valid trading history"}
    latest = valid[-1]
    latest_date = str(latest.get("date", ""))
    requested = datetime.strptime(requested_as_of, "%Y-%m-%d").date()
    observed = datetime.strptime(latest_date, "%Y-%m-%d").date()
    stale_days = (requested - observed).days
    metric = metric_label = None
    metric_values: list[float] = []
    metric_current = None
    for field, label in (("peTTM", "PE-TTM"), ("pbMRQ", "PB-MRQ"), ("psTTM", "PS-TTM")):
        current = number(latest.get(field))
        values = [value for row in valid if (value := number(row.get(field))) is not None and value > 0]
        if current is not None and current > 0 and len(values) >= MIN_VALUATION_OBSERVATIONS:
            metric, metric_label, metric_values, metric_current = field, label, values, current
            break
    prices = [number(row.get("close")) for row in valid[-PRICE_WINDOW:]]
    clean_prices = [value for value in prices if value is not None and value > 0]
    drawdown = change_60d = change_252d = volatility = None
    if len(clean_prices) >= MIN_PRICE_OBSERVATIONS:
        peak = max(clean_prices)
        drawdown = round((clean_prices[-1] / peak - 1) * 100, 2)
        if len(clean_prices) >= 61:
            change_60d = round((clean_prices[-1] / clean_prices[-61] - 1) * 100, 2)
        change_252d = round((clean_prices[-1] / clean_prices[0] - 1) * 100, 2)
        returns = [math.log(current / previous) for previous, current in zip(clean_prices, clean_prices[1:])]
        volatility = round(statistics.stdev(returns) * math.sqrt(252) * 100, 2) if len(returns) >= 2 else None
    valuation_percentile = percentile_rank(metric_values, metric_current) if metric and metric_current is not None else None
    complete = bool(valuation_percentile is not None and drawdown is not None and change_60d is not None and change_252d is not None and volatility is not None and len(metric_values) >= MIN_VALUATION_OBSERVATIONS and len(clean_prices) >= MIN_PRICE_OBSERVATIONS and 0 <= stale_days <= 10)
    raw_hash = hashlib.sha256(json.dumps(valid, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {
        "dataComplete": complete, "asOf": latest_date, "requestedAsOf": requested_as_of, "staleDays": stale_days,
        "valuationMetric": metric_label, "valuationCurrent": metric_current, "valuationPercentile": valuation_percentile,
        "valuationHistoryCount": len(metric_values), "valuationWindowYears": 5, "drawdown52wPct": drawdown,
        "change60dPct": change_60d, "change252dPct": change_252d, "volatilityAnnualizedPct": volatility,
        "priceHistoryCount": len(clean_prices), "drawdownWindowTradingDays": PRICE_WINDOW,
        "source": "Baostock daily valuation and forward-adjusted price history", "sourceUrl": SOURCE_URL,
        "rawHash": raw_hash, "error": "" if complete else "historical valuation or price coverage is incomplete",
    }


def baostock_code(code: str) -> str:
    digits = code.split(".")[0].strip()
    market = "sh" if digits.startswith(("6", "9")) else "bj" if digits.startswith(("4", "8")) else "sz"
    return f"{market}.{digits}"


def query_rows(bs: Any, code: str, start_date: str, end_date: str) -> list[dict[str, str]]:
    result = bs.query_history_k_data_plus(baostock_code(code), FIELDS, start_date=start_date, end_date=end_date, frequency="d", adjustflag="2")
    if result.error_code != "0":
        raise RuntimeError(f"{code}: {result.error_msg}")
    rows = []
    while result.next():
        rows.append(dict(zip(result.fields, result.get_row_data())))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", required=True)
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    import baostock as bs
    requested = datetime.strptime(args.as_of, "%Y-%m-%d").date()
    start = requested - timedelta(days=5 * 366 + 20)
    login = bs.login()
    if login.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {login.error_msg}")
    stocks: dict[str, dict[str, Any]] = {}
    try:
        for code in dict.fromkeys(item.strip() for item in args.codes.split(",") if item.strip()):
            try:
                stocks[code] = compute_metrics(query_rows(bs, code, start.isoformat(), requested.isoformat()), args.as_of)
            except Exception as error:
                stocks[code] = {"dataComplete": False, "error": str(error)}
    finally:
        bs.logout()
    payload = {"schemaVersion": 1, "requestedAsOf": args.as_of, "retrievedAt": datetime.now().astimezone().isoformat(), "source": "Baostock daily valuation and forward-adjusted price history", "sourceUrl": SOURCE_URL, "stocks": stocks}
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "SUCCESS", "requestedAsOf": args.as_of, "stocks": len(stocks), "complete": sum(bool(row.get("dataComplete")) for row in stocks.values()), "output": args.output}, ensure_ascii=False))


if __name__ == "__main__":
    main()
