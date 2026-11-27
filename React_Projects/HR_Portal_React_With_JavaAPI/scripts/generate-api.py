#!/usr/bin/env python3
"""Generates the typed API layer from the backend's live OpenAPI specs (openapi/<port>.json)
and the @PreAuthorize rules found in the Java controllers.

Outputs
  src/api/generated/operations.ts   machine-readable endpoint inventory (410 operations)
  src/api/types/<service>.ts        DTO interfaces (from components.schemas)
  src/api/services/<service>Api.ts  one typed function per endpoint
  src/api/services/index.ts
Re-run:  npm run generate:api   (set HR_BACKEND_DIR to the Java project to refresh @PreAuthorize rules)
"""
import json, os, re, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.environ.get("HR_BACKEND_DIR", os.path.expanduser("~/Documents/PROJECTS_TECKSTACK/Java_Projects/HR_Portal_API"))
SERVICES = {
    9101: "auth", 9102: "employee", 9103: "organization", 9104: "leave", 9105: "attendance",
    9106: "holiday", 9107: "payroll", 9108: "tax", 9109: "performance", 9110: "project",
    9111: "timesheet", 9112: "exit", 9113: "document", 9114: "notification", 9115: "reporting",
}
HTTP = ("get", "post", "put", "patch", "delete")


def camel(s):
    parts = re.split(r"[^A-Za-z0-9]+", s)
    parts = [p for p in parts if p]
    return "".join(p[:1].upper() + p[1:] for p in parts)


def lower_camel(s):
    c = camel(s)
    return c[:1].lower() + c[1:]


# ---------------------------------------------------------------- @PreAuthorize extraction
def load_security():
    rules = {}  # (METHOD, path) -> expr
    if not os.path.isdir(BACKEND):
        return rules
    ann = re.compile(r"@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^)]*)\))?")
    for f in glob.glob(BACKEND + "/**/controller/*Controller.java", recursive=True):
        src = open(f).read()
        m = re.search(r"@RequestMapping\(\s*(?:value\s*=\s*)?\"([^\"]*)\"", src)
        base = m.group(1) if m else ""
        cm = re.search(r"((?:@\w+(?:\([^)]*\))?\s*)*)public\s+class", src)
        cls_pre = None
        if cm:
            pm = re.search(r'@PreAuthorize\("((?:[^"\\]|\\.)*)"\)', cm.group(1))
            cls_pre = pm.group(1) if pm else None
        # split on method annotations
        for blk in re.finditer(r"((?:\s*@[\w.]+(?:\((?:[^()]|\([^()]*\))*\))?\s*)+)(?:public|private|protected)\s", src):
            block = blk.group(1)
            am = ann.search(block)
            if not am:
                continue
            path = ""
            if am.group(2):
                pm = re.search(r"\"([^\"]*)\"", am.group(2))
                path = pm.group(1) if pm else ""
            full = (base + path).rstrip("/") or "/"
            pre = re.search(r'@PreAuthorize\("((?:[^"\\]|\\.)*)"\)', block)
            expr = pre.group(1).replace('\\"', '"') if pre else cls_pre
            rules[(am.group(1).upper(), full)] = expr
    return rules


# ---------------------------------------------------------------- schema -> TS
def ts_type(s, services_schemas):
    if s is None:
        return "unknown"
    if "$ref" in s:
        return s["$ref"].split("/")[-1]
    if "enum" in s:
        return " | ".join(json.dumps(v) for v in s["enum"]) or "string"
    t = s.get("type")
    if "oneOf" in s or "anyOf" in s:
        return " | ".join(ts_type(x, services_schemas) for x in (s.get("oneOf") or s.get("anyOf")))
    if t == "array":
        inner = ts_type(s.get("items"), services_schemas)
        return f"({inner})[]" if "|" in inner else f"{inner}[]"
    if t in ("integer", "number"):
        return "number"
    if t == "boolean":
        return "boolean"
    if t == "string":
        return "string"
    if t == "object" or "properties" in s or "additionalProperties" in s:
        if "properties" in s:
            req = set(s.get("required", []))
            props = "; ".join(f"{json.dumps(k)}{'' if k in req else '?'}: {ts_type(v, services_schemas)}" for k, v in s["properties"].items())
            return "{ " + props + " }"
        ap = s.get("additionalProperties")
        if isinstance(ap, dict) and ap:
            return f"Record<string, {ts_type(ap, services_schemas)}>"
        return "Record<string, unknown>"
    return "unknown"


def schema_to_iface(name, s):
    if s.get("type") == "object" or "properties" in s:
        req = set(s.get("required", []))
        lines = []
        for k, v in s.get("properties", {}).items():
            desc = []
            for key in ("minLength", "maxLength", "minimum", "maximum", "pattern", "format"):
                if key in v:
                    desc.append(f"{key}={v[key]}")
            c = f"  /** {' '.join(desc)} */\n" if desc else ""
            lines.append(f"{c}  {json.dumps(k)}{'' if k in req else '?'}: {ts_type(v, None)};")
        if not lines:
            return f"export type {name} = Record<string, unknown>;\n"
        return f"export interface {name} {{\n" + "\n".join(lines) + "\n}\n"
    return f"export type {name} = {ts_type(s, None)};\n"


def resolve(spec, s):
    seen = 0
    while s and "$ref" in s and seen < 10:
        s = spec["components"]["schemas"].get(s["$ref"].split("/")[-1], {})
        seen += 1
    return s or {}


def main():
    security = load_security()
    ops = []
    type_files = {}
    used_names = {}
    for port, svc in SERVICES.items():
        spec = json.load(open(f"{ROOT}/openapi/{port}.json"))
        schemas = spec["components"].get("schemas", {})
        out = ["// GENERATED by scripts/generate-api.py from openapi/%d.json - do not edit\n" % port]
        for n, s in schemas.items():
            out.append(schema_to_iface(n, s))
        type_files[svc] = "\n".join(out)
        names_in_svc = set()
        for path, item in spec["paths"].items():
            for m in HTTP:
                if m not in item:
                    continue
                o = item[m]
                tag = (o.get("tags") or ["General"])[0]
                opid = o.get("operationId", m + camel(path))
                base = re.sub(r"_\d+$", "", opid)
                fn = lower_camel(base) if base == opid else lower_camel(base) + camel(tag)
                if path == "/ping":
                    fn = "ping"
                if path.endswith("/audit") and m == "get":
                    fn = "searchAudit"
                k = fn
                i = 2
                while k in names_in_svc:
                    k = fn + str(i)
                    i += 1
                fn = k
                names_in_svc.add(fn)
                params = o.get("parameters", [])
                pp = [p for p in params if p["in"] == "path"]
                qp = [p for p in params if p["in"] == "query"]
                body = None
                multipart = False
                rb = o.get("requestBody")
                if rb:
                    c = rb.get("content", {})
                    if "multipart/form-data" in c:
                        multipart = True
                        body = c["multipart/form-data"].get("schema")
                    else:
                        first = next(iter(c.values()), {})
                        body = first.get("schema")
                resp = None
                status = None
                binary = False
                for code in ("200", "201", "202", "204"):
                    if code in o.get("responses", {}):
                        status = code
                        c = o["responses"][code].get("content", {})
                        if c:
                            ct, v = next(iter(c.items()))
                            resp = v.get("schema")
                            if ct.startswith("application/octet") or ct.startswith("application/pdf") or ct.startswith("text/csv") or (resp or {}).get("format") == "binary":
                                binary = True
                        break
                public = path in ("/ping",) or path.endswith(("/login", "/refresh", "/forgot-password", "/reset-password")) and svc == "auth" and "/users/" not in path
                expr = security.get((m.upper(), path))
                # resolve query params that are objects (springdoc pageable style) to a flat list
                qlist = []
                for p in qp:
                    sch = p.get("schema", {})
                    rs = resolve(spec, sch)
                    if rs.get("type") == "object" and "properties" in rs and p["name"] in ("pageable", "filter", "request", "criteria", "query"):
                        for kk, vv in rs["properties"].items():
                            qlist.append({"name": kk, "required": False, "schema": resolve(spec, vv)})
                    else:
                        qlist.append({"name": p["name"], "required": bool(p.get("required")), "schema": rs if "enum" in rs else sch})
                ops.append({
                    "id": f"{svc}.{fn}", "service": svc, "fn": fn, "method": m.upper(), "path": path, "tag": tag,
                    "summary": o.get("summary") or opid, "operationId": opid,
                    "pathParams": [p["name"] for p in pp],
                    "query": qlist,
                    "body": body, "multipart": multipart,
                    "bodyType": ts_type(body, None) if body else None,
                    "responseType": ts_type(resp, None) if resp else None,
                    "responseStatus": status, "binary": binary,
                    "public": bool(public), "authorize": expr,
                    "_schemas": None,
                })
        # attach resolved schemas used by body (inline copy so the UI can build forms)
    # per-service schemas for the form builder
    schemas_all = {}
    for port, svc in SERVICES.items():
        spec = json.load(open(f"{ROOT}/openapi/{port}.json"))
        schemas_all[svc] = spec["components"].get("schemas", {})

    def deref(svc, s, depth=0):
        if s is None:
            return None
        if "$ref" in s:
            if depth > 4:
                return {"type": "object"}
            tgt = schemas_all[svc].get(s["$ref"].split("/")[-1], {})
            return deref(svc, tgt, depth + 1)
        r = dict(s)
        if "properties" in r:
            r["properties"] = {k: deref(svc, v, depth + 1) for k, v in r["properties"].items()}
        if "items" in r:
            r["items"] = deref(svc, r["items"], depth + 1)
        return r

    for o in ops:
        o["bodySchema"] = deref(o["service"], o["body"]) if o["body"] else None
        o.pop("body"); o.pop("_schemas")

    os.makedirs(f"{ROOT}/src/api/generated", exist_ok=True)
    os.makedirs(f"{ROOT}/src/api/types", exist_ok=True)
    os.makedirs(f"{ROOT}/src/api/services", exist_ok=True)
    with open(f"{ROOT}/src/api/generated/operations.ts", "w") as f:
        f.write("// GENERATED by scripts/generate-api.py - the complete backend endpoint inventory\n")
        f.write("import type { OperationDef } from '../operationTypes';\n\n")
        f.write("export const OPERATIONS: OperationDef[] = " + json.dumps(ops, indent=1) + ";\n")
    for svc, txt in type_files.items():
        open(f"{ROOT}/src/api/types/{svc}.ts", "w").write(txt)
    idx = ["// GENERATED\n"]
    for svc in SERVICES.values():
        sops = [o for o in ops if o["service"] == svc]
        lines = [f"// GENERATED by scripts/generate-api.py - {len(sops)} endpoints of the {svc} service",
                 "import { call } from '../client/call';",
                 f"import type * as T from '../types/{svc}';", ""]
        lines.append(f"export const {svc}Api = {{")
        for o in sops:
            args = []
            ctx = []
            for p in o["pathParams"]:
                args.append(f"{p}: string | number")
            ctx.append("path: {" + ", ".join(o["pathParams"]) + "}" if o["pathParams"] else "")
            if o["bodyType"]:
                bt = o["bodyType"]
                if o["multipart"]:
                    args.append("body: FormData")
                else:
                    if re.match(r"^[A-Za-z0-9_]+(\[\])?$", bt):
                        bt = re.sub(r"^([A-Za-z0-9_]+)", r"T.\1", bt)
                    args.append(f"body: {bt}")
                ctx.append("body")
            if o["query"]:
                args.append("query?: Record<string, unknown>")
                ctx.append("query")
            rt = o["responseType"] or "void"
            if o["binary"]:
                rt = "Blob"
            elif re.match(r"^[A-Za-z0-9_]+(\[\])?$", rt) and rt not in ("string", "number", "boolean", "unknown", "void"):
                rt = re.sub(r"^([A-Za-z0-9_]+)", r"T.\1", rt)
            ctxs = ", ".join(c for c in ctx if c)
            lines.append(f"  /** {o['method']} {o['path']} - {o['summary'].replace('*/', '')} */")
            lines.append(f"  {o['fn']}: ({', '.join(args)}) => call<{rt}>('{o['id']}', {{{ctxs}}}),")
        lines.append("};\n")
        open(f"{ROOT}/src/api/services/{svc}Api.ts", "w").write("\n".join(lines))
        idx.append(f"export {{ {svc}Api }} from './{svc}Api';")
    open(f"{ROOT}/src/api/services/index.ts", "w").write("\n".join(idx) + "\n")
    print("operations:", len(ops), "with @PreAuthorize:", sum(1 for o in ops if o["authorize"]))
    miss = [o["id"] for o in ops if o["authorize"] is None and not o["public"]]
    print("no explicit rule (authenticated only):", len(miss))


if __name__ == "__main__":
    main()
