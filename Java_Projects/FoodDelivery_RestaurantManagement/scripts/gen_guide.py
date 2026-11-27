#!/usr/bin/env python3
"""
Builds the single comprehensive guide from docs/guide.template.md:
  {{code path | start-regex | end-regex | lang}}  -> real code excerpt (from the first line matching start through the first following line matching end)
  {{include docs/generated/kafka-catalog.md}}      -> generated fragments (see gen_kafka_docs.py / gen_trace_doc.py)
  {{services-table}}                                -> built from the services' application.yml + topology
Usage: python3 scripts/gen_guide.py <YYYYMMDDHHmm>   (the datetime prefix of the output file name)
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stamp = sys.argv[1] if len(sys.argv) > 1 else "000000000000"
tpl = open(os.path.join(ROOT, "docs", "guide.template.md")).read()


ERRORS = []


def code(m):
    path, start, end, lang = [x.strip() for x in m.group(1).split("|")]
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        ERRORS.append(f"missing file: {path}"); return "(missing)"
    lines = open(full).read().split("\n")
    i = next((n for n, l in enumerate(lines) if re.search(start, l)), None)
    if i is None:
        ERRORS.append(f"start not found in {path}: {start}"); return "(missing)"
    j = next((n for n in range(i, len(lines)) if re.search(end, lines[n])), None)
    if j is None:
        ERRORS.append(f"end not found in {path}: {end} (start line {i+1})"); return "(missing)"
    block = lines[i:j + 1]
    indent = min((len(l) - len(l.lstrip()) for l in block if l.strip()), default=0)
    block = [l[indent:] for l in block]
    return f"```{lang}\n// {path}\n" + "\n".join(block) + "\n```"


def include(m):
    p = os.path.join(ROOT, m.group(1).strip())
    return open(p).read() if os.path.exists(p) else f"*(fragment {m.group(1).strip()} not generated yet)*"


def services_table(_):
    rows = ["| Service | Port | Database | Own Maven module |", "|---|---|---|---|"]
    for y in sorted(glob.glob(os.path.join(ROOT, "*-service", "src", "main", "resources", "application.yml"))):
        t = open(y).read()
        name = re.search(r"name:\s*(\S+-service)", t).group(1)
        port = re.search(r"port:\s*(\d+)", t).group(1)
        db = re.search(r"/(food_\w+_db)", t).group(1)
        rows.append(f"| `{name}` | {port} | `{db}` | `{name}/pom.xml` |")
    return "\n".join(rows)


out = re.sub(r"\{\{code ([^}]+)\}\}", code, tpl)
out = re.sub(r"\{\{include ([^}]+)\}\}", include, out)
out = out.replace("{{services-table}}", services_table(None))
_e2e = os.path.join(ROOT, "docs", "generated", "e2e-summary.txt")
out = out.replace("{{E2E_SUMMARY}}", open(_e2e).read().strip() if os.path.exists(_e2e) else "(run scripts/e2e.py and save its last line to docs/generated/e2e-summary.txt)")
dest = os.path.join(ROOT, "docs", f"{stamp}-food-delivery-microservices-complete-guide.md")
open(dest, "w").write(out)
print("wrote", dest, f"({len(out.splitlines())} lines)")
for e in ERRORS:
    print("EXCERPT ERROR:", e)
sys.exit(1 if ERRORS else 0)
