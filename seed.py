#!/usr/bin/env python3
"""Generate synthetic data for the production status board demo.

Builds a SQLite database from schema.sql, fills it with made-up work orders for
one 8-hour shift, then exports what the board needs as board.json.

Usage:  python3 seed.py OUTPUT_JSON
All names, SKUs and quantities are invented. Seeded, so output is repeatable.
"""
import json
import random
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).parent
SHIFT_MINUTES = 480

LINES = ["Line A", "Line B", "Line C", "Line D"]
PRODUCTS = [
    ("BRK-100", "Steel bracket, small"),
    ("BRK-200", "Steel bracket, large"),
    ("PNL-310", "Enclosure panel"),
    ("FRM-420", "Mounting frame"),
    ("HNG-150", "Heavy-duty hinge"),
    ("CVR-260", "Access cover"),
    ("RCK-540", "Rack rail set"),
    ("SHD-330", "Machine guard"),
]
HOLD_REASONS = ["Dimension check", "Finish inspection", "Material query", "Operator sign-off"]


def build(db, rng):
    db.executescript((HERE / "schema.sql").read_text())
    db.executemany("INSERT INTO lines VALUES (?, ?)", list(enumerate(LINES, 1)))
    db.executemany("INSERT INTO products VALUES (?, ?)", PRODUCTS)

    wo_n = 1000
    holds = {}
    for line_id in range(1, len(LINES) + 1):
        clock = 0
        while clock < SHIFT_MINUTES - 45:
            wo_n += 1
            wo = f"WO-{wo_n}"
            sku = rng.choice(PRODUCTS)[0]
            qty = rng.choice([120, 160, 200, 240, 300, 360])
            duration = rng.randint(55, 110)
            planned_start, planned_end = clock, clock + duration
            db.execute("INSERT INTO work_orders VALUES (?,?,?,?,?,?)",
                       (wo, sku, line_id, qty, planned_start, planned_end))

            # Actual run: sometimes starts late, sometimes runs long, sometimes held.
            start = planned_start + rng.choice([0, 0, 0, 0, 5, 10])
            run = int(duration * rng.uniform(0.8, 1.12))
            events = [(-1, "queued"), (start, "in_production")]   # queued before the shift clock starts
            end = start + run
            if rng.random() < 0.3 and run > 40:
                hold_at = start + rng.randint(15, run - 15)
                hold_len = rng.randint(12, 35)
                events += [(hold_at, "quality_hold"), (hold_at + hold_len, "in_production")]
                holds[wo] = rng.choice(HOLD_REASONS)
                end += hold_len
            events.append((end, "complete"))
            db.executemany("INSERT INTO status_events VALUES (?,?,?)",
                           [(wo, m, s) for m, s in events])
            clock = end + rng.randint(3, 10)   # changeover before next order
    return holds


def export(db, holds):
    names = dict(PRODUCTS)
    orders = []
    for wo, sku, line_id, qty, ps, pe in db.execute(
            "SELECT wo_id, sku, line_id, qty_planned, planned_start, planned_end "
            "FROM work_orders ORDER BY line_id, planned_start"):
        ev = db.execute("SELECT minute, status FROM status_events WHERE wo_id=? ORDER BY minute",
                        (wo,)).fetchall()
        orders.append({
            "wo": wo, "sku": sku, "product": names[sku], "line": LINES[line_id - 1],
            "qty": qty, "plannedStart": ps, "plannedEnd": pe,
            "events": [[m, s] for m, s in ev], "holdReason": holds.get(wo),
        })
    return {"shiftMinutes": SHIFT_MINUTES, "shiftStart": "06:00", "lines": LINES, "orders": orders}


if __name__ == "__main__":
    out = Path(sys.argv[1])
    db = sqlite3.connect(":memory:")
    holds = build(db, random.Random(42))
    out.write_text(json.dumps(export(db, holds), separators=(",", ":")))
    print(f"wrote {out} ({len(export(db, holds)['orders'])} work orders)")
