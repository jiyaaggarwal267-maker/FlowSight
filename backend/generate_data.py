"""FLOWSIGHT Step 1a: synthetic transaction data generator.

Generates a realistic Indian payments corpus (accounts + ~90 days of
transactions) with deliberately embedded AML-typology patterns, and writes
the result to data/accounts.json and data/transactions.json (no database).

Embedded patterns (each on dedicated accounts):
  1. Circular flow    A -> B -> C -> A, funds return to origin within <=72h
  2. Fan-out          one account smears small amounts to 10-20 targets quickly
  3. Fan-in           many accounts funnel into one account quickly
  4. Behavioral dev.  long-quiet account spikes 5-10x baseline frequency/volume
  5. Rapid movement   mule account forwards >=90% of a big inflow within 2h
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

SEED = 20260911
DATA_DIR = Path(__file__).resolve().parent / "data"

# ---------------------------------------------------------------- config

N_ACCOUNTS = 230
SPAN_DAYS = 90
START = datetime(2024, 8, 1, 0, 0, 0)

CHANNELS = {
    "UPI":  (0.0, 20_000, 0.52),
    "IMPS": (5_000, 250_000, 0.28),
    "NEFT": (50_000, 1_000_000, 0.15),
    "RTGS": (1_000_000, 12_000_000, 0.05),
}

BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Yes", "PNB", "BOB", "Canara", "IndusInd"]
CITIES = ["Mumbai", "Delhi NCR", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad"]

ENTITIES = [
    "Kiran Textiles", "Mehta Trading Co.", "Rajesh Enterprises", "Sunrise Grocers",
    "BlueLotus Exports", "Vertex Logistics", "Anand Agencies", "Paras Pharma",
    "GreenLeaf Farms", "Sharma Constructions", "Jain Metal Works", "Kaveri Retail",
    "Nova Digital", "Silverline Foods", "Om Exports", "Vikram Traders",
    "Everest Auto", "Bharat Solutions", "Shree Balaji Agencies", "Peacock Dyes",
    "Modern Cements", "Rathi Steels", "Zee Bakeries", "Universal Impex",
]


def fmt_indian(amount: int) -> str:
    """Format an amount in Indian lakh/crore shorthand, e.g. 420000 -> '₹4.2L'."""
    abs_a = abs(amount)
    if abs_a >= 1e7:
        return f"₹{amount / 1e7:.1f} Cr"
    if abs_a >= 1e5:
        return f"₹{amount / 1e5:.1f}L"
    return f"₹{amount:,}"


# ---------------------------------------------------------------- core

class Generator:
    def __init__(self, seed: int = SEED):
        self.rng = random.Random(seed)
        self.accounts: list[dict] = []
        self.transactions: list[dict] = []
        self.txn_counter = 0
        self.embedded: dict[str, dict] = {}

    def _acct_id(self, i: int) -> str:
        return f"AC-{10200 + i}"

    def _next_txn(self, from_id, to_id, amount, channel, ts) -> dict:
        self.txn_counter += 1
        return {
            "txn_id": f"TXN-{self.txn_counter:06d}",
            "from": from_id,
            "to": to_id,
            "amount": amount,
            "channel": channel,
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
        }

    def _channel_for(self, amount: int) -> str:
        for ch, (lo, hi, _w) in CHANNELS.items():
            if lo <= amount <= hi:
                return ch
        return "RTGS"

    def _sample_amount(self, channel: str) -> int:
        lo, hi, _w = CHANNELS[channel]
        return self.rng.randint(lo + 1, max(hi, 1))

    def _ts(self, tick) -> datetime:
        return START + timedelta(days=tick)

    # ---- normal behavior -------------------------------------------------

    def _push_txn(self, from_id, to_id, amount, channel, ts):
        self.transactions.append(self._next_txn(from_id, to_id, amount, channel, ts))

    def generate_normal(self, special_ids: set[str]):
        """Random daily activity for ordinary accounts."""
        for i in range(N_ACCOUNTS):
            acct_id = self._acct_id(i)
            if acct_id in special_ids:
                continue
            profile = self.rng.choices(["low", "medium", "high"], weights=[60, 30, 10])[0]
            base_rate = {"low": 1 / 7, "medium": 1.0, "high": 2.5}[profile]
            for tick in range(SPAN_DAYS):
                count = int(self.rng.random() > 1 - base_rate) if base_rate < 1 else self.rng.randint(0, 3)
                for _ in range(count):
                    other = self._acct_id(self.rng.randrange(N_ACCOUNTS))
                    if other == acct_id:
                        continue
                    channel = self.rng.choices(list(CHANNELS.keys()), [w for *_r, w in CHANNELS.values()])[0]
                    amount = self.rng.randint(*((500, 15_000) if channel == "UPI" else (20_000, 400_000)))
                    ts = self._ts(tick) + timedelta(
                        hours=self.rng.uniform(8, 20), minutes=self.rng.uniform(0, 59)
                    )
                    self._push_txn(acct_id, other, amount, channel, ts)

    # ---- embedded patterns ----------------------------------------------

    def embed_circular_flow(self):
        """A -> B -> C -> A with funds returning to origin within ~72h."""
        a, b, c = self._acct_id(7), self._acct_id(19), self._acct_id(45)
        day = 80
        t0 = self._ts(day) + timedelta(hours=9, minutes=10)
        t1 = t0 + timedelta(minutes=95)
        t2 = t0 + timedelta(hours=41)
        amt = 420_000
        self._push_txn(a, b, amt, "RTGS", t0)
        self._push_txn(b, c, int(amt * 0.94), "IMPS", t1)
        self._push_txn(c, a, int(amt * 0.86), "IMPS", t2)
        self.embedded["circular_flow"] = {
            "accounts": [a, b, c],
            "transactions": [t["txn_id"] for t in self.transactions[-3:]],
            "amount": amt,
            "close_hours": round((t2 - t0).total_seconds() / 3600, 1),
        }

    def embed_fan_out(self):
        """One account smears small amounts to 15 targets within ~2 hours."""
        hub = self._acct_id(63)
        tick = START + timedelta(days=83, hours=11)
        targets = []
        for _ in range(15):
            t = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            if t == hub or t in targets:
                continue
            targets.append(t)
        txns = []
        for i, t in enumerate(targets):
            ts = tick + timedelta(minutes=i * 7)
            amount = self.rng.randint(500, 6_000)
            self._push_txn(hub, t, amount, "UPI", ts)
            txns.append(self.transactions[-1]["txn_id"])
        self.embedded["fan_out"] = {"accounts": [hub] + targets, "transactions": txns}

    def embed_fan_in(self):
        """14 accounts funnel into one account within ~3 hours."""
        hub = self._acct_id(88)
        tick = START + timedelta(days=84, hours=10)
        feeders = []
        while len(feeders) < 14:
            t = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            if t == hub or t in feeders:
                continue
            feeders.append(t)
        txns = []
        for i, f in enumerate(feeders):
            ts = tick + timedelta(minutes=i * 11)
            amount = self.rng.randint(25_000, 180_000)
            self._push_txn(f, hub, amount, "IMPS", ts)
            txns.append(self.transactions[-1]["txn_id"])
        self.embedded["fan_in"] = {"accounts": feeders + [hub], "transactions": txns}

    def embed_behavioral_deviation(self):
        """Long-quiet account suddenly spikes to ~6x its baseline daily rate."""
        acct = self._acct_id(112)
        tick = START + timedelta(days=87, hours=9)
        txns = []
        for i in range(12):
            ts = tick + timedelta(hours=i * 3.5, minutes=self.rng.uniform(0, 45))
            amount = self.rng.randint(40_000, 250_000)
            other = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            if other == acct:
                other = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            self._push_txn(other, acct, amount, "IMPS", ts)
            txns.append(self.transactions[-1]["txn_id"])
        self.embedded["behavioral_deviation"] = {"accounts": [acct], "transactions": txns}

    def embed_rapid_movement(self):
        """Mule receives ~₹10L then forwards ~95% within 90 minutes."""
        mule = self._acct_id(135)
        tick = START + timedelta(days=85, hours=15)
        source = self._acct_id(self.rng.randrange(N_ACCOUNTS))
        in_ts = tick
        self._push_txn(source, mule, 1_000_000, "RTGS", in_ts)
        out_total = 0
        txns = [self.transactions[-1]["txn_id"]]
        for i, amount in enumerate([500_000, 310_000, 140_000]):
            ts = in_ts + timedelta(minutes=25 + i * 22)
            tgt = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            if tgt == mule:
                tgt = self._acct_id(self.rng.randrange(N_ACCOUNTS))
            self._push_txn(mule, tgt, amount, "IMPS" if i else "NEFT", ts)
            out_total += amount
            txns.append(self.transactions[-1]["txn_id"])
        self.embedded["rapid_movement"] = {
            "accounts": [mule],
            "transactions": txns,
            "inflow": 1_000_000,
            "out_ratio": round(out_total / 1_000_000, 3),
            "close_minutes": round((ts - in_ts).total_seconds() / 60, 1),
        }

    def embed_all(self):
        special = {
            self._acct_id(7), self._acct_id(19), self._acct_id(45),   # circular
            self._acct_id(63),                                        # fan-out
            self._acct_id(88),                                        # fan-in
            self._acct_id(112),                                       # behavioral
            self._acct_id(135),                                       # mule
        }
        self.generate_normal(special)
        self.embed_circular_flow()
        self.embed_fan_out()
        self.embed_fan_in()
        self.embed_behavioral_deviation()
        self.embed_rapid_movement()
        self.transactions.sort(key=lambda t: t["timestamp"])
        for idx, t in enumerate(self.transactions):
            self.txn_counter = idx + 1
            t["txn_id"] = f"TXN-{self.txn_counter:06d}"

    def build_accounts(self) -> list[dict]:
        for i in range(N_ACCOUNTS):
            self.accounts.append({
                "acct_id": self._acct_id(i),
                "entity": f"{self.rng.choice(ENTITIES)} {i % 9 + 1}",
                "bank": self.rng.choice(BANKS),
                "city": self.rng.choice(CITIES),
                "category": "retail" if self.rng.random() < 0.6 else "business",
            })
        return self.accounts

    # ---- output ----------------------------------------------------------

    def summary_lines(self) -> list[str]:
        lines = [
            f"accounts={len(self.accounts)}",
            f"transactions={len(self.transactions)}",
        ]
        e = self.embedded
        cf = e["circular_flow"]
        lines.append(
            f"circular_flow: {' -> '.join(cf['accounts'])} -> {cf['accounts'][0]}, "
            f"{fmt_indian(cf['amount'])}, closes in {cf['close_hours']} hours"
        )
        fo = e["fan_out"]
        lines.append(f"fan_out: {fo['accounts'][0]} -> {len(fo['accounts'])-1} targets, {len(fo['transactions'])} txns in ~2h")
        fi = e["fan_in"]
        lines.append(f"fan_in: {len(fi['accounts'])-1} feeders -> {fi['accounts'][-1]}, {len(fi['transactions'])} txns in ~3h")
        bd = e["behavioral_deviation"]
        lines.append(f"behavioral_deviation: {bd['accounts'][0]} quiet 60d then {len(bd['transactions'])} txns in ~42h")
        rm = e["rapid_movement"]
        lines.append(
            f"rapid_movement: {rm['accounts'][0]} received {fmt_indian(rm['inflow'])}, "
            f"forwarded {rm['out_ratio']*100:.0f}% in {rm['close_minutes']} minutes"
        )
        return lines

    def save(self, out_dir: Path = DATA_DIR) -> None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "accounts.json").write_text(json.dumps(self.accounts, indent=2))
        (out_dir / "transactions.json").write_text(json.dumps(self.transactions, indent=2))
        (out_dir / "embedded_patterns.json").write_text(json.dumps(self.embedded, indent=2))


def generate_and_save(out_dir: Path = DATA_DIR) -> tuple[list[dict], list[dict], dict]:
    """One-call entry point shared with detection tests and later API steps."""
    gen = Generator(SEED)
    gen.build_accounts()
    gen.embed_all()
    gen.save(out_dir)
    return gen.accounts, gen.transactions, {"patterns": gen.embedded, "summary": gen.summary_lines()}


if __name__ == "__main__":
    accounts, txns, meta = generate_and_save()
    print("FLOWSIGHT Step 1a — synthetic data generated")
    for line in meta["summary"]:
        print(f"  {line}")