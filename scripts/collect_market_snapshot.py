#!/usr/bin/env python3
"""Collect a low-frequency market snapshot for the selected A-share pool.

Baostock is the primary source here because it is free, structured, and has a
small Python client. The output is deliberately an appendable snapshot rather
than a live quote service: the dashboard only needs one post-close update per
day, and every value carries its source date.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


SELECTED_POOL = [
    ("300308", "中际旭创"),
    ("002837", "英维克"),
    ("688017", "绿的谐波"),
    ("300124", "汇川技术"),
    ("603662", "柯力传感"),
    ("688256", "寒武纪"),
    ("002463", "沪电股份"),
]

FIELDS = "date,code,open,high,low,close,preclose,volume,amount,turn,pctChg,peTTM,pbMRQ"


def parse_number(value: str | None) -> float | None:
    if value in (None, "", "null", "NULL"):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def market_code(code: str) -> str:
    return f"{'sh' if code.startswith('6') else 'sz'}.{code}"


def collect(start_date: str, end_date: str) -> dict[str, Any]:
    try:
        import baostock as bs
    except ImportError as exc:
        raise SystemExit(
            "缺少 Baostock。请先运行：python3 -m pip install -r requirements-data.txt"
        ) from exc

    login = bs.login()
    if login.error_code != "0":
        raise RuntimeError(f"Baostock 登录失败：{login.error_msg}")

    quotes: list[dict[str, Any]] = []
    try:
        for code, name in SELECTED_POOL:
            result = bs.query_history_k_data_plus(
                market_code(code),
                FIELDS,
                start_date=start_date,
                end_date=end_date,
                frequency="d",
                adjustflag="3",
            )
            rows: list[dict[str, str]] = []
            while result.next():
                rows.append(dict(zip(FIELDS.split(","), result.get_row_data())))

            if result.error_code != "0" or not rows:
                quotes.append(
                    {
                        "code": code,
                        "name": name,
                        "price": None,
                        "changePct": None,
                        "fiveDayChangePct": None,
                        "turnoverPct": None,
                        "peTTM": None,
                        "pbMRQ": None,
                        "date": None,
                        "status": "error",
                        "error": result.error_msg or "没有返回数据",
                    }
                )
                continue

            latest = rows[-1]
            close = parse_number(latest.get("close"))
            first_close = parse_number(rows[max(0, len(rows) - 5)].get("close"))
            five_day_change = None
            if close is not None and first_close not in (None, 0):
                five_day_change = round((close / first_close - 1) * 100, 2)

            quotes.append(
                {
                    "code": code,
                    "name": name,
                    "price": close,
                    "changePct": parse_number(latest.get("pctChg")),
                    "fiveDayChangePct": five_day_change,
                    "turnoverPct": parse_number(latest.get("turn")),
                    "peTTM": parse_number(latest.get("peTTM")),
                    "pbMRQ": parse_number(latest.get("pbMRQ")),
                    "date": latest.get("date"),
                    "status": "ok",
                }
            )
    finally:
        bs.logout()

    dates = [item["date"] for item in quotes if item.get("date")]
    return {
        "schemaVersion": 1,
        "collectedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "latestTradingDate": max(dates) if dates else None,
        "source": "Baostock",
        "sourceUrl": "https://www.baostock.com/",
        "status": "已更新" if any(item["status"] == "ok" for item in quotes) else "采集失败",
        "message": "仅更新当前选定池；公告、订单和技术参数仍需以官方披露与人工复核为准。",
        "quotes": quotes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="更新 AI 产业研究台的 A 股选定池行情快照")
    parser.add_argument("--output", default="data/market-snapshot.json")
    parser.add_argument("--start-date", default=None)
    parser.add_argument("--end-date", default=None)
    args = parser.parse_args()

    end_date = args.end_date or date.today().isoformat()
    start_date = args.start_date or (date.today() - timedelta(days=45)).isoformat()
    snapshot = collect(start_date, end_date)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": snapshot["status"], "latestTradingDate": snapshot["latestTradingDate"], "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"采集失败：{exc}", file=sys.stderr)
        raise
