# ΠΑΠΕΙ: the other departments' sites (and www.unipi.gr) refuse connections from this environment (2026-10-21).
from lib import missing
for d, host in {"unipi-econ": "econ.unipi.gr", "unipi-bus": "bus.unipi.gr", "unipi-des": "des.unipi.gr",
                "unipi-mar": "maritime.unipi.gr", "unipi-ind": "ie.unipi.gr", "unipi-stat": "stat.unipi.gr",
                "unipi-cs": "cs.unipi.gr", "unipi-ds": "ds.unipi.gr"}.items():
    missing("unipi", d, [f"https://{host}/", f"https://www.{host}/", "https://www.unipi.gr/"],
            "Site unreachable from the build environment (connection refused); re-run from a normal network.")
