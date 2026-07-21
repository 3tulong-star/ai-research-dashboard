#!/usr/bin/env python3
"""Build an auditable active A-share universe from Baostock.

The file is an input to the Node research pipeline. It contains no scores or
recommendations: only the active security master and CSRC industry labels.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import baostock as bs


A_SHARE = re.compile(r"^(?:sh\.(?:60|68)|sz\.(?:00|30)|bj\.(?:83|87|92))\d{4}$")


def rows(result):
    output = []
    while result.next():
        output.append(dict(zip(result.fields, result.get_row_data())))
    if result.error_code != "0":
        raise RuntimeError(result.error_msg)
    return output


def collect(as_of: str) -> dict:
    login = bs.login()
    if login.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {login.error_msg}")
    try:
        industries = rows(bs.query_stock_industry())
        requested = date.fromisoformat(as_of)
        securities = []
        resolved_as_of = as_of
        for offset in range(8):
            candidate = (requested - timedelta(days=offset)).isoformat()
            candidate_rows = rows(bs.query_all_stock(day=candidate))
            active_count = sum(
                1 for item in candidate_rows
                if item.get("tradeStatus") == "1" and A_SHARE.match(item.get("code", ""))
            )
            if active_count >= 4_500:
                securities = candidate_rows
                resolved_as_of = candidate
                break
    finally:
        bs.logout()

    industry_by_code = {
        item["code"]: item.get("industry", "")
        for item in industries
        if item.get("code")
    }
    active = []
    seen = set()
    for item in securities:
        market_code = item.get("code", "")
        if item.get("tradeStatus") != "1" or not A_SHARE.match(market_code):
            continue
        code = market_code.split(".", 1)[1]
        if code in seen:
            continue
        seen.add(code)
        active.append({
            "code": code,
            "name": item.get("code_name", "") or code,
            "industry": industry_by_code.get(market_code, ""),
        })

    if len(active) < 4_500:
        raise RuntimeError(f"active A-share coverage too small: {len(active)}")
    active.sort(key=lambda item: item["code"])
    return {
        "schemaVersion": 1,
        "asOf": resolved_as_of,
        "requestedAsOf": as_of,
        "retrievedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source": "Baostock query_all_stock + query_stock_industry",
        "sourceUrl": "https://www.baostock.com/",
        "count": len(active),
        "stocks": active,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    snapshot = collect(args.as_of)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"status": "SUCCESS", "asOf": snapshot["asOf"], "count": snapshot["count"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
