# ΠΑΔΑ departments without a readable programme (2026-10-21).
from lib import missing
missing("uniwa", "uniwa-php", ["https://php.uniwa.gr/studies/proptychiakes-spoydes/"],
        "The department's undergraduate programme has not started yet («Η έναρξη της εκπαιδευτικής λειτουργίας του ΠΠΣ … αναμένεται»).")
for d, host in {"uniwa-wine": "wine.uniwa.gr", "uniwa-photo": "photo.uniwa.gr"}.items():
    missing("uniwa", d, [f"https://{host}/"], "Site unreachable from the build environment; re-run from a normal network.")
