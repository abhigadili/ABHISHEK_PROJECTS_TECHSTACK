"""Generate documentation fragments from the LIVE system (so docs cannot drift from reality).

  var/docgen/db_schema.md      <- information_schema of the five MySQL databases
  var/docgen/api_reference.md  <- merged OpenAPI from the gateway + a hand-curated access matrix
  var/docgen/api_samples.md    <- a real request/response session executed through the gateway

Requires the stack to be running.  Usage: python scripts/gen_docs_data.py
"""

from __future__ import annotations

import json
import re
import time
import uuid
from collections import defaultdict
from pathlib import Path

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "var" / "docgen"
OUT.mkdir(parents=True, exist_ok=True)
ENV = dict(l.split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
GATEWAY = "http://localhost:8000"
DBS = {
    "StudentManagementAuthDB": "auth-service", "StudentManagementStudentDB": "student-service",
    "StudentManagementCourseDB": "course-service", "StudentManagementEnrollmentDB": "enrollment-service",
    "StudentManagementNotificationDB": "notification-service",
}


# ------------------------------------------------------------------------- database
def db_schema() -> str:
    url = URL.create("mysql+pymysql", username=ENV["MYSQL_USER"], password=ENV["MYSQL_PASSWORD"],
                     host=ENV.get("MYSQL_HOST", "localhost"), port=int(ENV.get("MYSQL_PORT", 3306)))
    eng = create_engine(url)
    md: list[str] = []
    with eng.connect() as c:
        for db, svc in DBS.items():
            tables = [r[0] for r in c.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema=:d ORDER BY table_name"), {"d": db})]
            md.append(f"\n## {db}  (owned by `{svc}`)\n")
            md.append(f"{len(tables)} tables (including `alembic_version`).\n")
            for t in tables:
                if t == "alembic_version":
                    continue
                md.append(f"\n### `{db}.{t}`\n")
                md.append("| Column | Type | Null | Default | Key / extra |\n|---|---|---|---|---|")
                for col, typ, nul, dflt, key, extra in c.execute(text(
                        "SELECT column_name, column_type, is_nullable, column_default, column_key, extra "
                        "FROM information_schema.columns WHERE table_schema=:d AND table_name=:t ORDER BY ordinal_position"),
                        {"d": db, "t": t}):
                    k = " ".join(x for x in (key, extra) if x)
                    md.append(f"| `{col}` | `{typ}` | {nul} | {('`' + str(dflt) + '`') if dflt is not None else ''} | {k} |")
                fks = c.execute(text(
                    "SELECT k.constraint_name, k.column_name, k.referenced_table_name, k.referenced_column_name, r.delete_rule "
                    "FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r "
                    "ON r.constraint_schema=k.constraint_schema AND r.constraint_name=k.constraint_name "
                    "WHERE k.table_schema=:d AND k.table_name=:t AND k.referenced_table_name IS NOT NULL"), {"d": db, "t": t}).all()
                if fks:
                    md.append("\n**Foreign keys**\n")
                    for name, col, rt, rc, rule in fks:
                        md.append(f"- `{col}` -> `{rt}.{rc}` ON DELETE {rule}  *(constraint `{name}`)*")
                idx = defaultdict(list)
                uniq: dict[str, int] = {}
                for name, col, non_unique in c.execute(text(
                        "SELECT index_name, column_name, non_unique FROM information_schema.statistics "
                        "WHERE table_schema=:d AND table_name=:t ORDER BY index_name, seq_in_index"), {"d": db, "t": t}):
                    idx[name].append(col)
                    uniq[name] = non_unique
                if idx:
                    md.append("\n**Indexes**\n")
                    for name, cols in idx.items():
                        kind = "PRIMARY KEY" if name == "PRIMARY" else ("UNIQUE" if not uniq[name] else "INDEX")
                        md.append(f"- {kind} `{name}` ({', '.join(cols)})")
                chk = [r[0] for r in c.execute(text(
                    "SELECT cc.constraint_name FROM information_schema.table_constraints tc JOIN information_schema.check_constraints cc "
                    "ON cc.constraint_schema=tc.constraint_schema AND cc.constraint_name=tc.constraint_name "
                    "WHERE tc.table_schema=:d AND tc.table_name=:t AND tc.constraint_type='CHECK'"), {"d": db, "t": t})]
                if chk:
                    md.append("\n**Check constraints**: " + ", ".join(f"`{x}`" for x in chk))
            ver = c.execute(text(f"SELECT version_num FROM `{db}`.alembic_version")).scalar()
            md.append(f"\nAlembic revision applied: `{ver}`\n")
    (OUT / "db_schema.md").write_text("\n".join(md))
    return "\n".join(md)


# --------------------------------------------------------------------------- API reference
ACCESS = [  # (method regex, path regex, access text) - first match wins
    (r".*", r"^/api/v1/auth/(register|login|token|refresh|forgot-password|reset-password)$", "Public"),
    (r".*", r"^/api/v1/auth/oidc/.*", "Public (501 unless OIDC is configured)"),
    (r".*", r"^/api/v1/auth/(logout|me|change-password)$", "Any authenticated user"),
    (r".*", r"^/api/v1/(users|roles)", "ADMIN - scope `users:manage`"),
    (r"GET", r"^/api/v1/departments$", "Any authenticated user"),
    (r"POST|DELETE", r"^/api/v1/departments", "ADMIN - scope `students:write`"),
    (r"GET|PATCH", r"^/api/v1/students/me$", "Any authenticated user - scope `profile:self`"),
    (r"GET", r"^/api/v1/students/stats$", "ADMIN, TEACHER - scope `students:read`"),
    (r".*", r"^/api/v1/students/bulk", "ADMIN - scope `students:write`"),
    (r"GET", r"^/api/v1/students$", "ADMIN, TEACHER - scope `students:read`"),
    (r"POST", r"^/api/v1/students$", "ADMIN, TEACHER - scope `students:write`"),
    (r"GET", r"^/api/v1/students/\{student_id\}$", "ADMIN/TEACHER, or the student themself"),
    (r"PUT|PATCH", r"^/api/v1/students/\{student_id\}$", "ADMIN, TEACHER - scope `students:write`"),
    (r"DELETE", r"^/api/v1/students/\{student_id\}$", "ADMIN - scope `students:write`"),
    (r".*", r"^/api/v1/students/\{student_id\}/(contacts|interests)", "ADMIN, TEACHER - scope `students:write`"),
    (r"GET", r"^/api/v1/students/\{student_id\}/(documents|profile-picture)", "ADMIN/TEACHER, or the owning student - scope `files:read`"),
    (r".*", r"^/api/v1/students/\{student_id\}/(documents|profile-picture)", "ADMIN/TEACHER, or the owning student - scope `files:write`"),
    (r"GET", r"^/api/v1/categories$", "Any authenticated user - scope `courses:read`"),
    (r".*", r"^/api/v1/categories", "ADMIN - scope `courses:write`"),
    (r"GET", r"^/api/v1/courses(/\{course_id\})?$", "Any authenticated user - scope `courses:read`"),
    (r"POST", r"^/api/v1/courses$", "ADMIN, TEACHER - scope `courses:write`"),
    (r"PUT|PATCH", r"^/api/v1/courses/\{course_id\}(/availability)?$", "ADMIN, or the TEACHER who created/teaches it"),
    (r"DELETE", r"^/api/v1/courses/\{course_id\}$", "ADMIN - scope `courses:write` (409 while enrolled)"),
    (r".*", r"^/api/v1/courses/\{course_id\}/teachers", "ADMIN - scope `courses:write`"),
    (r"GET", r"^/api/v1/courses/\{course_id\}/documents", "Any authenticated user - scope `files:read`"),
    (r".*", r"^/api/v1/courses/\{course_id\}/documents", "ADMIN, or the TEACHER who created/teaches the course - scope `files:write`"),
    (r"POST", r"^/api/v1/enrollments$", "Any authenticated user - scope `enrollments:write` (students enroll only themselves)"),
    (r"GET", r"^/api/v1/enrollments$", "ADMIN, TEACHER - scope `enrollments:read`"),
    (r"GET", r"^/api/v1/enrollments/(me)$", "Any authenticated user - scope `enrollments:read`"),
    (r"GET", r"^/api/v1/enrollments/(stats|courses/\{course_id\})$", "ADMIN, TEACHER - scope `enrollments:read`"),
    (r"GET", r"^/api/v1/enrollments/students/", "ADMIN/TEACHER, or the student (own rows only)"),
    (r"GET", r"^/api/v1/enrollments/\{enrollment_id\}", "ADMIN/TEACHER, or the enrolled student"),
    (r"PATCH", r"^/api/v1/enrollments/\{enrollment_id\}$", "ADMIN, TEACHER - scope `enrollments:write`"),
    (r"POST", r"^/api/v1/enrollments/\{enrollment_id\}/cancel$", "ADMIN/TEACHER, or the enrolled student"),
    (r"DELETE", r"^/api/v1/enrollments/", "ADMIN - scope `enrollments:write`"),
    (r"GET", r"^/api/v1/notifications", "ADMIN, TEACHER - scope `notifications:read`"),
    (r".*", r"^/api/v1/notifications", "ADMIN - scope `notifications:write`"),
]


def access_for(method: str, path: str) -> str:
    for m, p, a in ACCESS:
        if re.fullmatch(m, method) and re.search(p, path):
            return a
    return "?"


def _ref(spec: dict, node: dict) -> dict:
    while "$ref" in node:
        node = spec["components"]["schemas"][node["$ref"].split("/")[-1]]
    return node


def _type(spec: dict, node: dict) -> str:
    if "$ref" in node:
        return node["$ref"].split("/")[-1].split(".")[-1]
    if "anyOf" in node:
        parts = [_type(spec, n) for n in node["anyOf"] if n.get("type") != "null"]
        return " | ".join(parts) + ("?" if any(n.get("type") == "null" for n in node["anyOf"]) else "")
    if node.get("type") == "array":
        return f"{_type(spec, node.get('items', {}))}[]"
    t = node.get("type", "any")
    if "enum" in node:
        t = "enum(" + "/".join(map(str, node["enum"])) + ")"
    for k, label in (("minLength", "min"), ("maxLength", "max"), ("minimum", "≥"), ("maximum", "≤")):
        if k in node:
            t += f" {label}{node[k]}"
    if node.get("format"):
        t += f" ({node['format']})"
    return t


def body_table(spec: dict, op: dict) -> str:
    rb = op.get("requestBody")
    if not rb:
        return ""
    content = rb["content"]
    ctype, media = next(iter(content.items()))
    schema = _ref(spec, media["schema"])
    required = set(schema.get("required", []))
    rows = [f"| `{n}` | {_type(spec, s)} | {'yes' if n in required else 'no'} |" for n, s in schema.get("properties", {}).items()]
    return f"\n*Request body* (`{ctype}`):\n\n| Field | Type | Required |\n|---|---|---|\n" + "\n".join(rows) + "\n"


def api_reference() -> str:
    spec = httpx.get(f"{GATEWAY}/openapi.json", timeout=20).json()
    groups: dict[str, list[tuple[str, str, dict]]] = defaultdict(list)
    for path, item in spec["paths"].items():
        for method, op in item.items():
            groups[op.get("tags", ["Other"])[0]].append((path, method.upper(), op))
    order = ["Authentication", "OpenID Connect (optional)", "Users (admin)", "Roles (admin)", "Departments", "Students",
             "Student files", "Course categories", "Courses", "Course files", "Enrollments", "Notifications"]
    md: list[str] = []
    for tag in order:
        if tag not in groups:
            continue
        md.append(f"\n### {tag}\n")
        md.append("| Method | Path | Summary | Access |\n|---|---|---|---|")
        for path, method, op in sorted(groups[tag], key=lambda x: (x[0], x[1])):
            md.append(f"| `{method}` | `{path}` | {op.get('summary', '')} | {access_for(method, path)} |")
        md.append("")
        for path, method, op in sorted(groups[tag], key=lambda x: (x[0], x[1])):
            params = [p for p in op.get("parameters", []) if p["in"] in ("query", "path")]
            codes = ", ".join(sorted(op["responses"]))
            md.append(f"<details><summary><code>{method} {path}</code> - {op.get('summary', '')}</summary>\n")
            md.append(f"*Access*: {access_for(method, path)}  \n*Success/other documented codes*: {codes}  \n")
            if params:
                md.append("\n*Parameters*:\n\n| Name | In | Type | Required |\n|---|---|---|---|")
                for p in params:
                    md.append(f"| `{p['name']}` | {p['in']} | {_type(spec, p['schema'])} | {'yes' if p.get('required') else 'no'} |")
            md.append(body_table(spec, op))
            ok = next((c for c in op["responses"] if c.startswith("2")), None)
            if ok and "content" in op["responses"][ok]:
                sch = next(iter(op["responses"][ok]["content"].values()))["schema"]
                md.append(f"\n*Response {ok}*: `{_type(spec, sch)}`\n")
            md.append("\n</details>\n")
    (OUT / "api_reference.md").write_text("\n".join(md))
    return "\n".join(md)


# ------------------------------------------------------------------------------ samples
def trunc(s: str) -> str:
    return re.sub(r"eyJ[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{3,}", lambda m: m.group(0)[:18] + "…<truncated>", s)


def api_samples() -> str:
    run = uuid.uuid4().hex[:6]
    md: list[str] = []
    c = httpx.Client(base_url=GATEWAY, timeout=30)
    state: dict[str, str] = {}

    def call(title: str, method: str, path: str, *, token: str | None = None, json_body=None, data=None,
             show_headers: tuple[str, ...] = (), note: str = "") -> httpx.Response:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        r = c.request(method, path, json=json_body, data=data, headers=headers)
        curl = [f"curl -s -X {method} '{GATEWAY}{path}'"]
        if token:
            curl.append("  -H 'Authorization: Bearer $TOKEN'")
        if json_body is not None:
            curl += ["  -H 'Content-Type: application/json'", f"  -d '{json.dumps(json_body)}'"]
        if data is not None:
            curl.append("  " + " ".join(f"-d '{k}={v}'" for k, v in data.items() if k != "password") + " -d 'password=…'")
        md.append(f"\n#### {title}\n" + (f"{note}\n" if note else ""))
        md.append("```bash\n" + " \\\n".join(curl) + "\n```")
        hdr = "".join(f"{h}: {r.headers[h]}\n" for h in show_headers if h in r.headers)
        try:
            body = trunc(json.dumps(r.json(), indent=2)) if r.content else ""
        except ValueError:
            body = f"<{len(r.content)} bytes, {r.headers.get('content-type')}>"
        if len(body) > 1800:
            body = body[:1800] + "\n  … (truncated)"
        md.append(f"```http\nHTTP {r.status_code}\n{hdr}\n{body}\n```")
        return r

    pwd = "Str0ng!Passw0rd#1"
    call("Register (public)", "POST", "/api/v1/auth/register", json_body={"email": f"sample.{run}@example.com", "full_name": "Sample Student", "password": pwd})
    call("Weak password -> standard 422 error envelope", "POST", "/api/v1/auth/register", json_body={"email": "x@example.com", "full_name": "Weak", "password": "weak"})
    adm = call("OAuth2 password grant (admin)", "POST", "/api/v1/auth/token",
               data={"username": ENV["BOOTSTRAP_ADMIN_EMAIL"], "password": ENV["BOOTSTRAP_ADMIN_PASSWORD"], "scope": "students:read students:write courses:read courses:write enrollments:write enrollments:read"},
               note="Form-encoded (RFC 6749 §4.3). `scope` narrows the token to what the caller asks for.").json()
    tok = adm["access_token"]
    call("No token -> 401", "GET", "/api/v1/students")
    code = "SA" + "".join("ABCDEFGHIJ"[int(d)] for d in str(int(time.time()))[-3:])
    call("Create department", "POST", "/api/v1/departments", token=tok, json_body={"code": code, "name": f"Sample Dept {run}"})
    s = call("Create student (nested profile, contacts, interests)", "POST", "/api/v1/students", token=tok, json_body={
        "first_name": "Ada", "last_name": "Lovelace", "email": f"ada.{run}@example.com", "date_of_birth": "2001-12-10", "gender": "FEMALE",
        "department_code": code, "gpa": "3.80", "profile": {"city": "London", "bio": "Mathematics"},
        "contacts": [{"contact_type": "PHONE", "value": "+44 20 7946 0958", "is_primary": True}], "interests": ["Mathematics", "Poetry"]}).json()
    call("List students: filter + sort + paginate", "GET", f"/api/v1/students?department={code}&sort=gpa&order=desc&page=1&size=5", token=tok)
    cat = call("Create category", "POST", "/api/v1/categories", token=tok, json_body={"name": f"Sample Cat {run}"}).json()
    course = call("Create course", "POST", "/api/v1/courses", token=tok, json_body={
        "code": code + "101", "title": "Intro to Python", "category_id": cat["id"], "credits": 4, "duration_weeks": 12, "capacity": 2, "status": "OPEN"}).json()
    enr = call("Enroll (validates student + course over REST, publishes StudentEnrolled)", "POST", "/api/v1/enrollments", token=tok,
               json_body={"student_id": s["id"], "course_id": course["id"]},
               show_headers=("x-request-id", "x-correlation-id", "x-ratelimit-limit", "x-ratelimit-remaining")).json()
    call("Duplicate enrollment -> 409", "POST", "/api/v1/enrollments", token=tok, json_body={"student_id": s["id"], "course_id": course["id"]})
    time.sleep(2)
    call("Course after the Kafka event: enrolled_count / available_seats updated", "GET", f"/api/v1/courses/{course['id']}", token=tok)
    call("Enrollment with status history", "GET", f"/api/v1/enrollments/{enr['id']}", token=tok)
    call("Notification history (e-mails produced by the events)", "GET", "/api/v1/notifications?size=3&sort=id&order=desc", token=tok)
    call("Upload a profile picture (multipart) as admin", "PUT", f"/api/v1/students/{s['id']}/profile-picture", token=tok) if False else None
    out = "\n".join(md)
    (OUT / "api_samples.md").write_text(out)
    return out


if __name__ == "__main__":
    print("db schema:", len(db_schema()), "chars")
    print("api reference:", len(api_reference()), "chars")
    print("api samples:", len(api_samples()), "chars")
