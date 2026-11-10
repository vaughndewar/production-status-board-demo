# Production status board demo

A small shop-floor status board, built from scratch on **synthetic data**. It shows, line by line, what is running, what is on quality hold, what is next, and how many orders finished on time. It replays one made-up 8-hour shift in the browser, and has a kiosk view for a wall-mounted screen.

Every line, product, work order and number is invented. Nothing here comes from a real company's database, system or code.

## How it works

1. **`schema.sql`** — a small made-up schema: `lines`, `products`, `work_orders`, and `status_events` (one row per status change). The current status of an order is its latest event at or before the time you ask about.
2. **`seed.py`** — builds that schema in an in-memory SQLite database, generates one shift with a fixed random seed (so the output is repeatable), and exports what the board needs to `web/board.json`.
3. **`web/`** — plain HTML, CSS and JavaScript. The page loads `board.json` and replays the shift. No frameworks, no build step, no tracking.

Accessibility notes: status is shown with words and symbols, not colour alone; the page works in light and dark mode; controls are keyboard accessible; reduced-motion preferences start the demo paused.

## Run it

You need Python 3 (standard library only).

```bash
python3 seed.py web/board.json      # optional: regenerate the synthetic shift
cd web && python3 -m http.server 8000
```

Then open http://localhost:8000. (Use a local server rather than opening the file directly, because the page fetches `board.json`.)

Add `?kiosk=1` to the URL, or use the "Kiosk view" link, for the large wall-screen layout.

## Change the shift

Edit the constants and random ranges in `seed.py` (lines, products, hold reasons, timing), then run the seed command again.

## Using this for a real plant

A real version would read live work-order data from your plant's system instead of a JSON file, and add things like authentication, data refresh and alerting. The idea is the same: one screen that shows everyone what is running and what is stuck.

## Author

Vaughn Dewar, Ideal Consulting, Toronto. Released under the MIT License.
