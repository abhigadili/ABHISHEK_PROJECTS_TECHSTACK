#!/usr/bin/env python3
"""End-to-end checks through the API Gateway (:8080). Needs the whole stack running (scripts/start-local.sh).
Creates its own uniquely-named data (run id suffix) so it can be re-run. Exit code != 0 on any failed assertion."""
import json, os, sys, time, uuid, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

GW = os.environ.get("GATEWAY", "http://localhost:8080")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "Admin@123")
RABBIT = os.environ.get("RABBIT_API", "http://localhost:15672")
RUN = uuid.uuid4().hex[:6]
FAILS = []

def call(method, path, body=None, token=None, headers=None, base=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    if headers: h.update(headers)
    req = urllib.request.Request((base or GW) + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def check(name, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"   -> {detail}"))
    if not cond: FAILS.append(name)

def poll(fn, timeout=40, every=1.0):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v: return v
        time.sleep(every)
    return None

# ---------------------------------------------------------------- auth
s, _ = call("GET", "/api/students"); check("gateway rejects request without token (401)", s == 401, s)
s, t = call("POST", "/api/auth/login", {"username": "admin", "password": ADMIN_PW}); check("admin login", s == 200, (s, t))
admin = t["accessToken"]; refresh = t["refreshToken"]
s, t2 = call("POST", "/api/auth/refresh", {"refreshToken": refresh}); check("refresh token rotation issues new pair", s == 200 and t2["refreshToken"] != refresh, (s, t2))
s, _ = call("POST", "/api/auth/refresh", {"refreshToken": refresh}); check("old refresh token is revoked (401)", s == 401, s)
s, _ = call("POST", "/api/auth/login", {"username": "admin", "password": "wrong"}); check("bad password -> 401", s == 401, s)
s, me = call("GET", "/api/auth/me", token=admin); check("/me returns Admin", s == 200 and me["role"] == "Admin", (s, me))
s, _ = call("GET", "/api/students", token="not.a.jwt"); check("garbage token -> 401", s == 401, s)

# ---------------------------------------------------------------- master data
s, cat = call("POST", "/api/courses/categories", {"name": f"Cat-{RUN}", "description": "e2e"}, admin); check("create category", s == 201, (s, cat))
def mk_course(code, seats):
    return call("POST", "/api/courses", {"courseName": f"Course {code}", "courseCode": code, "categoryId": cat["categoryId"], "durationWeeks": 6, "fees": 1000, "totalSeats": seats}, admin)
s, c2 = mk_course(f"E2E-{RUN}-A".upper(), 2); check("create course (2 seats)", s == 201, (s, c2))
def mk_student(i, first="Stu"):
    return call("POST", "/api/students", {"firstName": first, "lastName": f"N{i}", "email": f"s{i}.{RUN}@example.com"}, admin)
students = [mk_student(i)[1] for i in range(1, 5)]
s1, s2, s3, s4 = [x["studentId"] for x in students]
check("create 4 students", all(x and x.get("studentId") for x in students))
s, bad = call("POST", "/api/students", {"firstName": "", "lastName": "x", "email": "nope"}, admin)
check("validation failure -> 400 with field errors", s == 400 and "email" in bad.get("fieldErrors", {}), (s, bad))

# ---------------------------------------------------------------- role checks
s, reg = call("POST", "/api/auth/register", {"username": f"stu{RUN}", "email": f"stu{RUN}@example.com", "password": "Passw0rd!", "firstName": "Self", "lastName": "Serve"})
check("public registration creates Student", s == 201 and reg["role"] == "Student", (s, reg))
s, _ = call("POST", "/api/auth/register", {"username": f"adm{RUN}", "email": f"adm{RUN}@example.com", "password": "Passw0rd!", "role": "Admin"}); check("anonymous cannot register Admin (403)", s == 403, s)
s, _ = call("POST", "/api/auth/register", {"username": f"staff{RUN}", "email": f"staff{RUN}@example.com", "password": "Passw0rd!", "role": "Staff"}, admin); check("Admin can create Staff", s == 201, s)
s, tok = call("POST", "/api/auth/login", {"username": f"stu{RUN}", "password": "Passw0rd!"}); stu_tok = tok["accessToken"]; stu_id = tok["studentId"]
s, _ = call("GET", "/api/students", token=stu_tok); check("Student cannot list students (403)", s == 403, s)
s, _ = call("GET", f"/api/students/{stu_id}", token=stu_tok); check("Student can read own profile", s == 200, s)
s, _ = call("GET", f"/api/students/{s1}", token=stu_tok); check("Student cannot read another student (403)", s == 403, s)
s, _ = call("POST", "/api/courses", {"courseName": "x", "courseCode": "XX-1", "durationWeeks": 1, "fees": 1, "totalSeats": 1}, stu_tok); check("Student cannot create course (403)", s == 403, s)
s, _ = call("GET", "/api/courses", token=stu_tok); check("Student can browse courses", s == 200, s)
s, _ = call("POST", "/api/enrollments", {"studentId": s1, "courseId": c2["courseId"]}, stu_tok); check("Student cannot enroll someone else (403)", s == 403, s)

# ---------------------------------------------------------------- enrollment workflows
cid = c2["courseId"]
s, r = call("POST", "/api/enrollments", {"studentId": s1, "courseId": cid}, admin, {"Idempotency-Key": f"k1-{RUN}"})
check("enroll student -> 201 Confirmed", s == 201 and r["result"] == "Confirmed", (s, r)); eid1 = r["enrollment"]["enrollmentId"]
s, r2 = call("POST", "/api/enrollments", {"studentId": s1, "courseId": cid}, admin, {"Idempotency-Key": f"k1-{RUN}"})
check("idempotent replay returns the same enrollment", s == 201 and r2["enrollment"]["enrollmentId"] == eid1, (s, r2))
s, r = call("POST", "/api/enrollments", {"studentId": s1, "courseId": cid}, admin, {"Idempotency-Key": f"k1b-{RUN}"}); check("duplicate active enrollment -> 409", s == 409, (s, r))
s, a = call("GET", f"/api/courses/{cid}/availability", token=admin); check("seat reserved (1 of 2 left)", a["availableSeats"] == 1, a)
s, r = call("POST", "/api/enrollments", {"studentId": 99999999, "courseId": cid}, admin); check("unknown student -> 422 Rejected", s == 422 and "does not exist" in r["message"], (s, r))
s, r = call("POST", "/api/enrollments", {"studentId": s2, "courseId": 99999999}, admin); check("unknown course -> 422 Rejected", s == 422 and "does not exist" in r["message"], (s, r))
call("PATCH", f"/api/students/{s3}/status", {"status": "Inactive"}, admin)
s, r = call("POST", "/api/enrollments", {"studentId": s3, "courseId": cid}, admin); check("inactive student -> 422 Rejected", s == 422 and "not eligible" in r["message"], (s, r))
s, r = call("POST", "/api/enrollments", {"studentId": s2, "courseId": cid}, admin); check("second student fills the course", s == 201, (s, r)); eid2 = r["enrollment"]["enrollmentId"]
s, r = call("POST", "/api/enrollments", {"studentId": s4, "courseId": cid}, admin); check("sold out -> 422 Rejected (no seats)", s == 422 and "no seats" in r["message"].lower(), (s, r))
s, a = call("GET", f"/api/courses/{cid}/availability", token=admin); check("course full, seats not negative", a["availableSeats"] == 0, a)
s, h = call("GET", f"/api/enrollments/student/{s1}", token=admin); check("student history lists enrollment", s == 200 and any(e["enrollmentId"] == eid1 for e in h["content"]), h)
s, h = call("GET", f"/api/enrollments/course/{cid}?status=Confirmed", token=admin); check("course enrollments (Confirmed) = 2", s == 200 and h["totalElements"] == 2, h)
s, h = call("GET", f"/api/enrollments?studentId={s4}&status=Rejected", token=admin); check("search enrollments by student+status", s == 200 and h["totalElements"] == 1, h)
s, r = call("POST", f"/api/enrollments/{eid1}/cancel", {"reason": "e2e cancel"}, admin); check("cancel Confirmed enrollment", s == 200 and r["enrollmentStatus"] == "Cancelled", (s, r))
s, a = call("GET", f"/api/courses/{cid}/availability", token=admin); check("cancel released the seat", a["availableSeats"] == 1, a)
s, r = call("POST", f"/api/enrollments/{eid1}/cancel", None, admin); check("cancel again -> 422", s == 422, (s, r))
s, r = call("POST", "/api/enrollments", {"studentId": s1, "courseId": cid}, admin); check("re-enroll after cancel works", s == 201, (s, r))

# ---------------------------------------------------------------- async notifications (RabbitMQ -> inbox -> dispatcher)
def notif_types(student):
    s, p = call("GET", f"/api/notifications/student/{student}?size=50", token=admin)
    return {(n["notificationType"], n["status"]) for n in p["content"]} if s == 200 else set()
ok = poll(lambda: ("EnrollmentConfirmed", "Sent") in notif_types(s2))
check("confirmation notification created and Sent for student 2", bool(ok), notif_types(s2))
ok = poll(lambda: {("EnrollmentConfirmed", "Sent"), ("EnrollmentCancelled", "Sent")} <= notif_types(s1))
check("confirmation + cancellation notifications for student 1", bool(ok), notif_types(s1))
ok = poll(lambda: ("EnrollmentRejected", "Sent") in notif_types(s4))
check("rejection notification for sold-out student", bool(ok), notif_types(s4))
s, allp = call("GET", "/api/notifications?type=EnrollmentConfirmed&size=100", token=admin)
per_enr = {}
for n in allp["content"]: per_enr[n["enrollmentId"]] = per_enr.get(n["enrollmentId"], 0) + 1
check("no duplicate notifications per enrollment", all(v == 1 for v in per_enr.values()), per_enr)

# ---------------------------------------------------------------- concurrency: 15 students race for 4 seats
s, c3 = mk_course(f"E2E-{RUN}-B".upper(), 4)
many = [mk_student(100 + i)[1]["studentId"] for i in range(15)]
def enroll(stu): return call("POST", "/api/enrollments", {"studentId": stu, "courseId": c3["courseId"]}, admin)
with ThreadPoolExecutor(max_workers=15) as ex: results = list(ex.map(enroll, many))
confirmed = [r for s, r in results if s == 201]; rejected = [r for s, r in results if s == 422]
check("concurrent enrollments: exactly 4 Confirmed", len(confirmed) == 4, [s for s, _ in results])
check("concurrent enrollments: other 11 Rejected", len(rejected) == 11, [s for s, _ in results])
s, a = call("GET", f"/api/courses/{c3['courseId']}/availability", token=admin); check("seats exactly 0 (never negative / oversold)", a["availableSeats"] == 0 and a["totalSeats"] == 4, a)

# ---------------------------------------------------------------- observability + health through the stack
for name, port in [("student", 8081), ("course", 8082), ("enrollment", 8083), ("notification", 8084), ("gateway", 8080)]:
    s, h = call("GET", "/health/ready", base=f"http://localhost:{port}")
    check(f"{name} readiness healthy", s == 200, (s, h))
try:
    with urllib.request.urlopen("http://localhost:8083/metrics", timeout=10) as r:
        body = r.read().decode(); check("enrollment exposes Prometheus metrics incl. outbox counter", "outbox_events_published" in body)
except Exception as e: check("enrollment exposes Prometheus metrics", False, e)

print(f"\n{'ALL CHECKS PASSED' if not FAILS else str(len(FAILS)) + ' CHECK(S) FAILED: ' + ', '.join(FAILS)}")
sys.exit(1 if FAILS else 0)
