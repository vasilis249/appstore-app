# ΕΚΠΑ departments whose sites (and the Wayback Machine) refuse connections from this environment (2026-10-19):
# recorded as missing, nothing guessed. Re-run the scrapers from a normal network to fill them.
from lib import missing
NOTE = "Site not reachable from the build environment (connection reset / proxy 502), Wayback Machine too; to be filled from a normal network."
for dept, host in [("uoa-biol", "www.biol.uoa.gr"), ("uoa-ecedu", "www.ecd.uoa.gr"), ("uoa-primedu", "www.primedu.uoa.gr"),
                   ("uoa-turkish", "www.turkmas.uoa.gr"), ("uoa-ppp", "www.ppp.uoa.gr")]:
    missing("uoa", dept, [f"https://{host}/", f"https://web.archive.org/web/2026/https://{host}/"], NOTE)
