# Πάτρα departments without a readable programme from this container (re-run from a normal network).
from lib import missing
UNREACHABLE = "site refuses this container (connection reset / proxy 502)"
missing("upatras", "upatras-ece", ["https://www.ece.upatras.gr/"], UNREACHABLE)
missing("upatras", "upatras-ecedu", ["https://www.ecedu.upatras.gr/"], UNREACHABLE)
missing("upatras", "upatras-sustagri", ["http://susagri.upatras.gr/"], UNREACHABLE)
NOT_LISTED = "not in the university's 2026 list of undergraduate departments (upatras.gr/education/undergraduate-studies)"
missing("upatras", "upatras-env", ["https://www.env.upatras.gr/", "https://www.upatras.gr/education/undergraduate-studies/"], NOT_LISTED)
missing("upatras", "upatras-culture", ["https://www.cult.upatras.gr/", "https://www.upatras.gr/education/undergraduate-studies/"], NOT_LISTED)
