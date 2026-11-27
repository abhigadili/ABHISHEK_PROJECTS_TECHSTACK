"""Replay postman/SMS.postman_collection.json against the running stack (newman substitute).

It resolves {{variables}}, sends every request in order (JSON, urlencoded, multipart uploads),
applies the per-request bearer auth, evaluates the collection's status expectations, executes the
`pm.collectionVariables.set(...)` saves and the simple `j.<path>` assertions (translated to Python).
Use real newman / the Postman runner for the full JS sandbox; this keeps the repo's verification
dependency-free.

    python scripts/run_postman_collection.py [--base-url http://localhost:8000]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
PM = ROOT / "postman"


class J:
    """Wraps JSON so JS-style paths (j.a.b, j[0].id, j.items.length) evaluate in Python."""

    def __init__(self, v):
        self._v = v

    def __getattr__(self, name):
        v = self._v
        if name == "length":
            return len(v)
        if name == "indexOf":
            return lambda x: v.index(x) if x in v else -1
        return J(v[name]) if isinstance(v, dict) and name in v else J(None)

    def __getitem__(self, i):
        v = self._v[i]
        return J(v) if isinstance(v, (dict, list)) else v

    def __eq__(self, o):
        return self._v == (o._v if isinstance(o, J) else o)

    def __bool__(self):
        return bool(self._v)

    def __ge__(self, o):
        return self._v >= o

    def __gt__(self, o):
        return self._v > o

    def __str__(self):
        v = self._v
        return json.dumps(v) if isinstance(v, (dict, list)) else str(v)

    def raw(self):
        return self._v


def _js_to_py(expr: str) -> str:
    expr = re.sub(r"/(\^.*?\$)/\.test\((.*?)\)", lambda m: f"_re({m.group(1)!r}, {m.group(2)})", expr)
    expr = expr.replace("===", "==").replace("&&", " and ").replace("||", " or ")
    expr = re.sub(r"!(?!=)", " not ", expr)
    expr = re.sub(r"\btrue\b", "True", expr)
    expr = re.sub(r"\bfalse\b", "False", expr)
    expr = re.sub(r"Object\.keys\((.*?)\)\.length", r"len(\1.raw())", expr)
    expr = re.sub(r"JSON\.stringify\(j\)\.includes\((.*?)\)", r"(\1 in json.dumps(j.raw()))", expr)
    expr = re.sub(r"\.indexOf\((.*?)\) >= 0", r".indexOf(\1) >= 0", expr)
    return expr


def run(base_url: str) -> int:
    col = json.loads((PM / "SMS.postman_collection.json").read_text())
    env = json.loads((PM / "SMS.local.postman_environment.json").read_text())
    vars_: dict[str, str] = {v["key"]: v["value"] for v in env["values"]}
    for line in (ROOT / ".env").read_text().splitlines():  # admin credentials come from .env, not from the repo files
        if line.startswith("BOOTSTRAP_ADMIN_EMAIL="):
            vars_["adminEmail"] = line.split("=", 1)[1]
        if line.startswith("BOOTSTRAP_ADMIN_PASSWORD="):
            vars_["adminPassword"] = line.split("=", 1)[1]
    vars_["baseUrl"] = base_url
    vars_.update({v["key"]: v["value"] for v in col.get("variable", []) if v["key"] not in vars_})

    def sub(text: str) -> str:
        return re.sub(r"\{\{(\w+)\}\}", lambda m: str(vars_.get(m.group(1), m.group(0))), text)

    client = httpx.Client(timeout=30)
    ok = bad = 0
    failures: list[str] = []
    for fold in col["item"]:
        print(f"\n== {fold['name']}")
        for it in fold["item"]:
            rq = it["request"]
            for ev in it.get("event", []):
                if ev["listen"] == "prerequest" and "suffix" in "".join(ev["script"]["exec"]):
                    s = str(int(time.time() * 1000))[-8:]
                    vars_.update(suffix=s, studentEmail=f"pm.student.{s}@example.com", teacherEmail=f"pm.teacher.{s}@example.com",
                                 deptCode="PM" + s[-4:], courseCode="PM" + "".join("ABCDEFGHIJ"[int(d)] for d in s[-3:]) + "101")
            url = sub(rq["url"]["raw"])
            auth = rq.get("auth") or col["auth"]
            headers = {}
            if auth["type"] == "bearer":
                headers["Authorization"] = "Bearer " + sub(auth["bearer"][0]["value"])
            body = rq.get("body")
            kw: dict = {}
            files = []
            if body and body["mode"] == "raw":
                kw["content"] = sub(body["raw"])
                headers["Content-Type"] = "application/json"
            elif body and body["mode"] == "urlencoded":
                kw["data"] = {f["key"]: sub(f["value"]) for f in body["urlencoded"]}
            elif body and body["mode"] == "formdata":
                data, files = {}, []
                for f in body["formdata"]:
                    if f["type"] == "file":
                        p = PM / f["src"]
                        ctype = f.get("contentType") or ("image/png" if p.suffix == ".png" else "application/pdf")
                        files.append((f["key"], (p.name, p.read_bytes(), ctype)))
                    else:
                        data[f["key"]] = sub(f["value"])
                kw["data"], kw["files"] = data, files
            r = client.request(rq["method"], url, headers=headers, **kw)
            tests = "\n".join(l for ev in it["event"] if ev["listen"] == "test" for l in ev["script"]["exec"])
            expected = [int(c) for c in re.search(r"status is one of \[([\d, ]+)\]", tests).group(1).split(",")]
            problems = []
            if r.status_code not in expected:
                problems.append(f"status {r.status_code} not in {expected}: {r.text[:140]}")
            try:
                j = J(r.json()) if r.content and "json" in r.headers.get("content-type", "") else J(None)
            except ValueError:
                j = J(None)
            for m in re.finditer(r"collectionVariables\.set\('(\w+)', String\((.*?)\)\); \}", tests):
                if r.status_code in expected and r.status_code < 300:
                    try:
                        vars_[m.group(1)] = str(eval(_js_to_py(m.group(2)), {"j": j}))  # noqa: S307 - trusted local file
                    except Exception as exc:
                        problems.append(f"cannot save {m.group(1)}: {exc!r}")
            for m in re.finditer(r"pm\.test\((\".*?\"), function \(\) \{ var j = pm\.response\.json\(\); pm\.expect\((.*)\)\.to\.be\.ok; \}\);", tests):
                try:
                    if r.status_code < 300 and not eval(_js_to_py(m.group(2)), {"j": j, "json": json, "_re": lambda p, s: re.search(p, str(s)) is not None}):  # noqa: S307
                        problems.append(f"assertion failed: {json.loads(m.group(1))}")
                except Exception as exc:
                    problems.append(f"assertion error {json.loads(m.group(1))}: {exc!r}")
            if problems:
                bad += 1
                failures.append(f"{it['name']}: {'; '.join(problems)}")
                print(f"  [FAIL] {it['name']} -> {'; '.join(problems)}")
            else:
                ok += 1
                print(f"  [PASS] {rq['method']:6} {it['name']}  ({r.status_code})")
    print(f"\nRESULT: {ok}/{ok + bad} requests passed")
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    sys.exit(run(ap.parse_args().base_url))
