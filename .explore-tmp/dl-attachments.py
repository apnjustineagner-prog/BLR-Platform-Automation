#!/usr/bin/env python3
"""Download Jira attachments via Basic auth (email + API token), following redirects."""
import base64
import os
import sys
import urllib.request
import urllib.error

EMAIL = os.environ["JIRA_EMAIL"]
TOKEN = os.environ["JIRA_API_TOKEN"]
CLOUD = "e691d9f7-cd7d-458d-a681-6a1f9f816a48"
OUT = ".explore-tmp/pot-781"
os.makedirs(OUT, exist_ok=True)

auth = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()

# id -> friendly name
items = {
    "22043": "receipt-page",
    "22044": "downloaded-receipt",
    "22041": "email-receipt",
}

for aid, name in items.items():
    url = f"https://api.atlassian.com/ex/jira/{CLOUD}/rest/api/3/attachment/content/{aid}"
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
    try:
        # urllib follows redirects by default; the signed CDN URL doesn't need our auth header
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
            ct = resp.headers.get("Content-Type", "?")
            path = os.path.join(OUT, f"{aid}-{name}.png")
            with open(path, "wb") as f:
                f.write(data)
            print(f"{aid} ({name}): {len(data)} bytes, {ct} -> {path}")
    except urllib.error.HTTPError as e:
        print(f"{aid} ({name}): HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f"{aid} ({name}): ERROR {e}")
