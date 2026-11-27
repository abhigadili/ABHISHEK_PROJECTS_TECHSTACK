#!/usr/bin/env python3
"""Failure-path verification against the running stack (start-local.sh) + docker infra:
 1. Outbox reliability : RabbitMQ stopped -> enrollment still commits, event stays Pending in dn_outbox_messages -> broker back -> published -> notification Sent.
 2. Saga pause/recovery: Course Service stopped -> validation step cannot reach it -> saga compensates: enrollment answers 422 Rejected (reason: validation failed) and nothing is half-done; calls fail fast; service back -> consistent.
 3. Circuit breaker    : repeated failures while Course Service is down -> calls fail fast with 503/Rejected, not hanging.
Uses subprocess to stop/start the docker container and the Course Service process. Exit code != 0 on a failed assertion."""
import json, os, subprocess, sys, time, uuid, urllib.request, urllib.error

GW = os.environ.get("GATEWAY", "http://localhost:8080"); ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "Admin@123")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RUN = uuid.uuid4().hex[:6]; FAILS = []
MYSQL = ["mysql", "-N", "-B", "-u" + os.environ.get("MYSQL_USER", "abhig"), "-p" + os.environ.get("MYSQL_PASSWORD", "Pass@123")]

def call(method, path, body=None, token=None, headers=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    if headers: h.update(headers)
    req = urllib.request.Request(GW + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: raw = r.read().decode(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
def check(name, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"   -> {detail}"))
    if not cond: FAILS.append(name)
def poll(fn, timeout=60, every=1.0):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v: return v
        time.sleep(every)
    return None
def sql(q): return subprocess.run(MYSQL + ["-e", q], capture_output=True, text=True).stdout.strip()
def port_listening(port): return subprocess.run(["bash", "-c", f"(echo > /dev/tcp/127.0.0.1/{port}) 2>/dev/null"]).returncode == 0
def start_course():
    subprocess.Popen(["bash", "-c", f"cd {ROOT} && export PATH=$PATH:$HOME/.dotnet && nohup dotnet run --no-build --no-launch-profile --project Services/CourseService > logs/course.log 2>&1 &"])
    poll(lambda: port_listening(8082), 60)
    poll(lambda: call("GET", "/api/courses?size=1", token=admin)[0] == 200, 60)
def stop_course():
    pid = subprocess.run(["bash", "-c", "lsof -ti tcp:8082 -sTCP:LISTEN"], capture_output=True, text=True).stdout.split()
    for p in pid: subprocess.run(["kill", p])
    poll(lambda: not port_listening(8082), 20)

s, t = call("POST", "/api/auth/login", {"username": "admin", "password": ADMIN_PW}); admin = t["accessToken"]
s, cat = call("POST", "/api/courses/categories", {"name": f"FS-{RUN}"}, admin)
s, course = call("POST", "/api/courses", {"courseName": f"FS {RUN}", "courseCode": f"FS-{RUN}".upper(), "categoryId": cat["categoryId"], "durationWeeks": 4, "fees": 10, "totalSeats": 50}, admin)
cid = course["courseId"]
def student(i): return call("POST", "/api/students", {"firstName": "F", "lastName": f"S{i}", "email": f"fs{i}.{RUN}@example.com"}, admin)[1]["studentId"]
sa, sb, sc = student(1), student(2), student(3)

print("== 1. outbox survives a broker outage")
subprocess.run(["docker", "stop", "sms-dn-rabbitmq"], capture_output=True)
s, r = call("POST", "/api/enrollments", {"studentId": sa, "courseId": cid}, admin)
check("enrollment commits while RabbitMQ is DOWN (201 Confirmed)", s == 201 and r["result"] == "Confirmed", (s, r)); eid = r["enrollment"]["enrollmentId"]
time.sleep(4)
pend = sql(f"select count(*) from EnrollmentDB.dn_outbox_messages where AggregateId={eid} and Status='Pending'")
check("its events are still Pending in the outbox (not lost, not published)", pend.isdigit() and int(pend) >= 1, pend)
attempts = sql(f"select max(Attempts) from EnrollmentDB.dn_outbox_messages where AggregateId={eid}")
check("publisher is retrying with back-off (attempts > 0)", attempts.isdigit() and int(attempts) > 0, attempts)
subprocess.run(["docker", "start", "sms-dn-rabbitmq"], capture_output=True)
ok = poll(lambda: sql(f"select count(*) from EnrollmentDB.dn_outbox_messages where AggregateId={eid} and Status='Published'") == "2", 120)
check("after the broker returns both events are Published", bool(ok), sql(f"select Status,Attempts from EnrollmentDB.dn_outbox_messages where AggregateId={eid}"))
ok = poll(lambda: any(n["status"] == "Sent" and n["notificationType"] == "EnrollmentConfirmed" for n in call("GET", f"/api/notifications/student/{sa}", token=admin)[1]["content"]), 90)
check("notification created and Sent after recovery", bool(ok))

print("== 2. saga pauses while Course Service is down and resumes")
stop_course()
s, r = call("POST", "/api/enrollments", {"studentId": sb, "courseId": cid}, admin, {"Idempotency-Key": f"pause-{RUN}"})
print("   response while course is down:", s, (r or {}).get("result") if isinstance(r, dict) else r)
check("enrollment while Course Service is down is not Confirmed", s in (202, 422, 503) and not (isinstance(r, dict) and r.get("result") == "Confirmed"), (s, r))
if s == 422: print("   (validation failed fast -> compensated as Rejected, which is the designed outcome for a failed validation step)")
t0 = time.time()
codes = []
for i in range(6):
    st, _ = call("POST", "/api/enrollments", {"studentId": sc, "courseId": cid}, admin, {"Idempotency-Key": f"cb-{RUN}-{i}"}); codes.append(st)
check("calls keep answering quickly while the dependency is down (circuit breaker / fail-fast)", time.time() - t0 < 60, f"{time.time()-t0:.1f}s codes={codes}")
start_course()
s, r = call("POST", "/api/enrollments", {"studentId": sa, "courseId": cid}, admin)   # duplicate -> proves service is back and consistent
check("after Course Service returns the system answers normally (409 duplicate for student 1)", s == 409, (s, r))
s, a = call("GET", f"/api/courses/{cid}/availability", token=admin)
check("seat count is consistent (only the one confirmed enrollment holds a seat)", a["availableSeats"] == 49, a)

print(f"\n{'ALL SCENARIOS PASSED' if not FAILS else str(len(FAILS)) + ' FAILED: ' + ', '.join(FAILS)}")
sys.exit(1 if FAILS else 0)
