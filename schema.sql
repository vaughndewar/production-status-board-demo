-- Production status board: made-up manufacturing schema.
-- Everything here is synthetic. It is not based on any employer's database.

CREATE TABLE lines (
  line_id   INTEGER PRIMARY KEY,
  name      TEXT NOT NULL
);

CREATE TABLE products (
  sku       TEXT PRIMARY KEY,
  name      TEXT NOT NULL
);

CREATE TABLE work_orders (
  wo_id         TEXT PRIMARY KEY,
  sku           TEXT NOT NULL REFERENCES products(sku),
  line_id       INTEGER NOT NULL REFERENCES lines(line_id),
  qty_planned   INTEGER NOT NULL,
  planned_start INTEGER NOT NULL,   -- minutes from shift start
  planned_end   INTEGER NOT NULL
);

-- One row per status change. Current status = latest event at or before "now".
CREATE TABLE status_events (
  wo_id     TEXT NOT NULL REFERENCES work_orders(wo_id),
  minute    INTEGER NOT NULL,       -- minutes from shift start
  status    TEXT NOT NULL CHECK (status IN ('queued','in_production','quality_hold','complete')),
  PRIMARY KEY (wo_id, minute)
);

-- The query the board runs at a given minute (:now is a bound parameter;
-- SQLite views cannot take parameters, so this is a saved query, not a view):
--
--   SELECT w.wo_id, w.line_id, w.sku, w.qty_planned, w.planned_start, w.planned_end,
--          (SELECT status FROM status_events e
--            WHERE e.wo_id = w.wo_id AND e.minute <= :now
--            ORDER BY e.minute DESC LIMIT 1) AS status
--   FROM work_orders w;
