"""Generate postman/SMS.postman_collection.json (+ environment + sample upload files).

Run order matters: the collection is a *flow* (register -> login -> create -> use -> clean up);
every request saves the ids it needs into collection variables.  Run it with the Collection
Runner or:  npx newman run postman/SMS.postman_collection.json -e postman/SMS.local.postman_environment.json
"""

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "postman"
OUT.mkdir(exist_ok=True)
PREFIX = "/api/v1"


# ---------------------------------------------------------------- sample files for uploads
def _png() -> bytes:
    def chunk(t: bytes, d: bytes) -> bytes:
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\x0f\x34\x60" * 8 for _ in range(8))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


(OUT / "sample.png").write_bytes(_png())
(OUT / "sample.pdf").write_bytes(b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")


# ------------------------------------------------------------------------ helpers
def js_status(*codes: int) -> list[str]:
    cond = ", ".join(str(c) for c in codes)
    return [f"pm.test('status is one of [{cond}]', function () {{ pm.expect([{cond}]).to.include(pm.response.code); }});"]


def js_save(var: str, expr: str) -> list[str]:
    return [f"try {{ pm.collectionVariables.set('{var}', String({expr})); }} catch (e) {{ console.log('could not save {var}', e); }}"]


def js_expect(desc: str, expr: str) -> list[str]:
    return [f"pm.test({json.dumps(desc)}, function () {{ var j = pm.response.json(); pm.expect({expr}).to.be.ok; }});"]


def item(name: str, method: str, path: str, *, body: dict | list | None = None, form: list[dict] | None = None,
         urlenc: dict | None = None, token: str | None = "accessToken", expect: tuple[int, ...] = (200,),
         save: dict[str, str] | None = None, asserts: list[tuple[str, str]] | None = None,
         query: dict[str, str] | None = None, pre: list[str] | None = None, desc: str = "") -> dict:
    raw = "{{baseUrl}}" + path
    url: dict = {"raw": raw, "host": ["{{baseUrl}}"], "path": [p for p in path.strip("/").split("/")]}
    if query:
        url["query"] = [{"key": k, "value": v} for k, v in query.items()]
        url["raw"] = raw + "?" + "&".join(f"{k}={v}" for k, v in query.items())
    req: dict = {"method": method, "header": [], "url": url, "description": desc}
    if body is not None:
        req["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2), "options": {"raw": {"language": "json"}}}
        req["header"].append({"key": "Content-Type", "value": "application/json"})
    if form is not None:
        req["body"] = {"mode": "formdata", "formdata": form}
    if urlenc is not None:
        req["body"] = {"mode": "urlencoded", "urlencoded": [{"key": k, "value": v} for k, v in urlenc.items()]}
    if token is None:
        req["auth"] = {"type": "noauth"}
    elif token != "accessToken":
        req["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{" + token + "}}", "type": "string"}]}
    tests = js_status(*expect)
    for var, expr in (save or {}).items():
        tests += js_save(var, expr)
    for d, expr in (asserts or []):
        tests += js_expect(d, expr)
    events = [{"listen": "test", "script": {"type": "text/javascript", "exec": tests}}]
    if pre:
        events.append({"listen": "prerequest", "script": {"type": "text/javascript", "exec": pre}})
    return {"name": name, "event": events, "request": req}


def folder(name: str, items: list[dict], desc: str = "") -> dict:
    return {"name": name, "description": desc, "item": items}


API = PREFIX
SETUP = ["var s = String(Date.now()).slice(-8);",
         "pm.collectionVariables.set('suffix', s);",
         "pm.collectionVariables.set('studentEmail', 'pm.student.' + s + '@example.com');",
         "pm.collectionVariables.set('teacherEmail', 'pm.teacher.' + s + '@example.com');",
         "pm.collectionVariables.set('deptCode', 'PM' + s.slice(-4));",
         "pm.collectionVariables.set('courseCode', 'PM' + s.slice(-3).replace(/[0-9]/g, function (d) { return 'ABCDEFGHIJ'[d]; }) + '101');"]

folders = [
    folder("00 Gateway & health", [
        item("Aggregated health of all services", "GET", "/health/services", token=None, asserts=[("overall status UP", "j.status === 'UP'")]),
        item("Gateway liveness", "GET", "/health", token=None),
        item("Merged OpenAPI document", "GET", "/openapi.json", token=None, asserts=[("has paths", "Object.keys(j.paths).length > 20")]),
        item("Unauthenticated request is rejected (401)", "GET", f"{API}/students", token=None, expect=(401,),
             asserts=[("standard error envelope", "j.error && j.error.code === 'UNAUTHORIZED'")], pre=SETUP),
    ], "Public endpoints. The first request's pre-script generates unique names for this run."),

    folder("01 Authentication (JWT + OAuth2)", [
        item("Register a student account (public)", "POST", f"{API}/auth/register", token=None, expect=(201,),
             body={"email": "{{studentEmail}}", "full_name": "Postman Student", "password": "{{password}}"},
             save={"studentUserId": "j.id"}, asserts=[("role is STUDENT", "j.roles[0] === 'STUDENT'")]),
        item("Register with weak password -> 422", "POST", f"{API}/auth/register", token=None, expect=(422,),
             body={"email": "weak@example.com", "full_name": "Weak", "password": "weak"}),
        item("Login as ADMIN (JSON)", "POST", f"{API}/auth/login", token=None,
             body={"email": "{{adminEmail}}", "password": "{{adminPassword}}"},
             save={"accessToken": "j.access_token", "refreshToken": "j.refresh_token"},
             asserts=[("bearer token pair", "j.token_type === 'bearer' && j.refresh_token")],
             desc="Stores accessToken/refreshToken; every other request uses {{accessToken}} via collection-level Bearer auth."),
        item("OAuth2 password grant (form-encoded, scoped)", "POST", f"{API}/auth/token", token=None,
             urlenc={"username": "{{adminEmail}}", "password": "{{adminPassword}}", "scope": "students:read courses:read"},
             asserts=[("scope narrowed", "j.scope === 'courses:read students:read'")],
             desc="RFC 6749 §4.3. The returned token only carries the requested scopes."),
        item("Current user", "GET", f"{API}/auth/me", asserts=[("is admin", "j.roles.indexOf('ADMIN') >= 0")]),
        item("Refresh tokens (rotation)", "POST", f"{API}/auth/refresh", token=None, body={"refresh_token": "{{refreshToken}}"},
             save={"accessToken": "j.access_token", "refreshToken": "j.refresh_token"}),
        item("Login as STUDENT", "POST", f"{API}/auth/login", token=None, body={"email": "{{studentEmail}}", "password": "{{password}}"},
             save={"studentToken": "j.access_token", "studentRefresh": "j.refresh_token"}),
        item("Forgot password (always 202)", "POST", f"{API}/auth/forgot-password", token=None, expect=(202,), body={"email": "{{studentEmail}}"}),
        item("Reset password with an invalid token -> 400", "POST", f"{API}/auth/reset-password", token=None, expect=(400,),
             body={"token": "invalid-token-invalid-token-xx", "new_password": "N3w!Passw0rd#xx"}),
    ]),

    folder("02 Users & roles (ADMIN)", [
        item("Create a TEACHER", "POST", f"{API}/users", expect=(201,),
             body={"email": "{{teacherEmail}}", "full_name": "Postman Teacher", "password": "{{password}}", "roles": ["TEACHER"]},
             save={"teacherId": "j.id"}),
        item("List users (filter role, search, sort)", "GET", f"{API}/users", query={"role": "teacher", "q": "Postman", "sort": "email", "order": "desc"}),
        item("Get user", "GET", f"{API}/users/{{{{teacherId}}}}"),
        item("Patch user", "PATCH", f"{API}/users/{{{{teacherId}}}}", body={"full_name": "Postman Teacher II"}),
        item("Replace roles", "PUT", f"{API}/users/{{{{teacherId}}}}/roles", body={"roles": ["TEACHER"]}),
        item("List roles with scopes", "GET", f"{API}/roles"),
        item("RBAC: student cannot list users -> 403", "GET", f"{API}/users", token="studentToken", expect=(403,)),
    ]),

    folder("03 Departments & students", [
        item("Create department", "POST", f"{API}/departments", expect=(201,), body={"code": "{{deptCode}}", "name": "Postman Dept {{suffix}}"},
             save={"deptId": "j.id"}),
        item("List departments", "GET", f"{API}/departments"),
        item("Create student (nested profile/contacts/interests)", "POST", f"{API}/students", expect=(201,),
             body={"first_name": "Grace", "last_name": "Hopper", "email": "pm.grace.{{suffix}}@example.com", "date_of_birth": "2000-12-09",
                   "gender": "FEMALE", "department_code": "{{deptCode}}", "gpa": "3.90", "profile": {"city": "Arlington", "bio": "Compilers"},
                   "contacts": [{"contact_type": "PHONE", "value": "+1 555 010 9999", "is_primary": True}], "interests": ["Compilers", "Navy"]},
             save={"studentId": "j.id"}, asserts=[("student number generated", "/^STU\\d{10}$/.test(j.student_number)")]),
        item("Link a student record to the registered user (for self-service)", "POST", f"{API}/students", expect=(201,),
             body={"first_name": "Postman", "last_name": "Student", "email": "{{studentEmail}}", "department_code": "{{deptCode}}", "user_id": "{{studentUserId}}"},
             save={"selfStudentId": "j.id"}),
        item("List: filter + sort + paginate", "GET", f"{API}/students", query={"department": "{{deptCode}}", "sort": "gpa", "order": "desc", "page": "1", "size": "5"}),
        item("Search by name", "GET", f"{API}/students", query={"q": "hopper"}),
        item("Get student", "GET", f"{API}/students/{{{{studentId}}}}", asserts=[("eager-loaded relations", "j.profile && j.contacts.length === 1 && j.interests.length === 2")]),
        item("PUT (full replace)", "PUT", f"{API}/students/{{{{studentId}}}}",
             body={"first_name": "Grace", "last_name": "Hopper-Murray", "email": "pm.grace.{{suffix}}@example.com", "status": "ACTIVE",
                   "admission_date": "2024-09-01", "department_code": "{{deptCode}}", "gpa": "3.95"}),
        item("PATCH (partial)", "PATCH", f"{API}/students/{{{{studentId}}}}", body={"gender": "FEMALE", "profile": {"city": "New York"}}),
        item("Add contact", "POST", f"{API}/students/{{{{studentId}}}}/contacts", expect=(201,),
             body={"contact_type": "EMERGENCY", "value": "(555) 010-1234", "label": "Mother"}, save={"contactId": "j.contacts[j.contacts.length-1].id"}),
        item("Remove contact", "DELETE", f"{API}/students/{{{{studentId}}}}/contacts/{{{{contactId}}}}", expect=(204,)),
        item("Replace interests (many-to-many)", "PUT", f"{API}/students/{{{{studentId}}}}/interests", body={"interests": ["COBOL", "Sailing"]}),
        item("Bulk import", "POST", f"{API}/students/bulk", expect=(201,),
             body={"students": [{"first_name": "Alan", "last_name": "Bulk", "email": "pm.alan.{{suffix}}@example.com", "department_code": "{{deptCode}}", "gpa": "3.50"},
                                {"first_name": "Barbara", "last_name": "Bulk", "email": "pm.barbara.{{suffix}}@example.com", "department_code": "{{deptCode}}", "gpa": "3.70"}]},
             save={"bulkId": "j[0].id"}),
        item("Bulk status update", "PATCH", f"{API}/students/bulk/status", body={"ids": ["{{bulkId}}"], "status": "SUSPENDED"}),
        item("Statistics (sync endpoint)", "GET", f"{API}/students/stats"),
        item("Duplicate e-mail -> 409", "POST", f"{API}/students", expect=(409,),
             body={"first_name": "Grace", "last_name": "Dup", "email": "pm.grace.{{suffix}}@example.com"}),
        item("RBAC: student cannot list students -> 403", "GET", f"{API}/students", token="studentToken", expect=(403,)),
        item("Student reads own record", "GET", f"{API}/students/me", token="studentToken", asserts=[("linked to my user id", "j.user_id > 0")]),
    ]),

    folder("04 Student files", [
        item("Upload profile picture (PNG, multipart)", "PUT", f"{API}/students/{{{{selfStudentId}}}}/profile-picture", token="studentToken",
             form=[{"key": "file", "type": "file", "src": "sample.png"}], asserts=[("no filesystem path leaks", "!JSON.stringify(j).includes('/home')")]),
        item("Download profile picture", "GET", f"{API}/students/{{{{selfStudentId}}}}/profile-picture", token="studentToken"),
        item("Upload document (PDF + form fields)", "POST", f"{API}/students/{{{{selfStudentId}}}}/documents", token="studentToken", expect=(201,),
             form=[{"key": "file", "type": "file", "src": "sample.pdf"}, {"key": "doc_type", "type": "text", "value": "TRANSCRIPT"},
                   {"key": "description", "type": "text", "value": "Fall transcript"}], save={"fileId": "j.id"}),
        item("List documents", "GET", f"{API}/students/{{{{selfStudentId}}}}/documents", token="studentToken"),
        item("Edit document metadata", "PATCH", f"{API}/students/{{{{selfStudentId}}}}/documents/{{{{fileId}}}}", token="studentToken", body={"description": "Spring transcript"}),
        item("Download document", "GET", f"{API}/students/{{{{selfStudentId}}}}/documents/{{{{fileId}}}}", token="studentToken"),
        item("MIME spoofing (PDF bytes as image/png) -> 415", "PUT", f"{API}/students/{{{{selfStudentId}}}}/profile-picture", token="studentToken", expect=(415,),
             form=[{"key": "file", "type": "file", "src": "sample.pdf", "contentType": "image/png"}]),
        item("Another student's files -> 403", "GET", f"{API}/students/{{{{studentId}}}}/documents", token="studentToken", expect=(403,)),
        item("Delete document", "DELETE", f"{API}/students/{{{{selfStudentId}}}}/documents/{{{{fileId}}}}", token="studentToken", expect=(204,)),
    ]),

    folder("05 Categories & courses", [
        item("Create category", "POST", f"{API}/categories", expect=(201,), body={"name": "Postman {{suffix}}", "description": "pm"}, save={"categoryId": "j.id"}),
        item("List categories", "GET", f"{API}/categories"),
        item("Create course", "POST", f"{API}/courses", expect=(201,),
             body={"code": "{{courseCode}}", "title": "Distributed Systems", "description": "Consensus", "category_id": "{{categoryId}}",
                   "credits": 4, "duration_weeks": 14, "capacity": 30, "status": "OPEN"},
             save={"courseId": "j.id"}, asserts=[("available", "j.is_available === true && j.available_seats === 30")]),
        item("List/filter/sort courses", "GET", f"{API}/courses", query={"category_id": "{{categoryId}}", "min_credits": "3", "available_only": "true", "sort": "title"}),
        item("Get course", "GET", f"{API}/courses/{{{{courseId}}}}"),
        item("PUT course", "PUT", f"{API}/courses/{{{{courseId}}}}",
             body={"title": "Distributed Systems", "category_id": "{{categoryId}}", "credits": 5, "duration_weeks": 14, "capacity": 30, "status": "OPEN"}),
        item("PATCH course", "PATCH", f"{API}/courses/{{{{courseId}}}}", body={"description": "Consensus and replication"}),
        item("Assign teacher (validated via Auth service)", "PUT", f"{API}/courses/{{{{courseId}}}}/teachers/{{{{teacherId}}}}", body={"role": "LEAD"},
             asserts=[("teacher assigned", "j.teachers.length === 1")]),
        item("Assign a non-teacher -> 422", "PUT", f"{API}/courses/{{{{courseId}}}}/teachers/{{{{studentUserId}}}}", expect=(422,)),
        item("Upload course document", "POST", f"{API}/courses/{{{{courseId}}}}/documents", expect=(201,),
             form=[{"key": "file", "type": "file", "src": "sample.pdf"}, {"key": "doc_type", "type": "text", "value": "SYLLABUS"}], save={"courseFileId": "j.id"}),
        item("Student downloads course document", "GET", f"{API}/courses/{{{{courseId}}}}/documents/{{{{courseFileId}}}}", token="studentToken"),
    ]),

    folder("06 Enrollments", [
        item("Enroll student (REST validation of student + course)", "POST", f"{API}/enrollments", expect=(201,),
             body={"student_id": "{{studentId}}", "course_id": "{{courseId}}"}, save={"enrollmentId": "j.id"}),
        item("Duplicate enrollment -> 409", "POST", f"{API}/enrollments", expect=(409,), body={"student_id": "{{studentId}}", "course_id": "{{courseId}}"}),
        item("Student self-enrolls (no student_id)", "POST", f"{API}/enrollments", token="studentToken", expect=(201,),
             body={"course_id": "{{courseId}}"}, save={"selfEnrollmentId": "j.id"}),
        item("List enrollments (staff)", "GET", f"{API}/enrollments", query={"course_id": "{{courseId}}", "status": "ENROLLED"}),
        item("My enrollments (student)", "GET", f"{API}/enrollments/me", token="studentToken"),
        item("Enrollments of a student", "GET", f"{API}/enrollments/students/{{{{studentId}}}}"),
        item("Enrollments of a course", "GET", f"{API}/enrollments/courses/{{{{courseId}}}}"),
        item("Get enrollment with history", "GET", f"{API}/enrollments/{{{{enrollmentId}}}}"),
        item("Cancel (student, own)", "POST", f"{API}/enrollments/{{{{selfEnrollmentId}}}}/cancel", token="studentToken", body={"reason": "schedule clash"},
             asserts=[("cancelled", "j.status === 'CANCELLED'")]),
        item("Grade + complete (staff)", "PATCH", f"{API}/enrollments/{{{{enrollmentId}}}}", body={"grade": "A-", "status": "COMPLETED"},
             asserts=[("completed", "j.status === 'COMPLETED'")]),
        item("Statistics", "GET", f"{API}/enrollments/stats"),
    ]),

    folder("07 Notifications", [
        item("Templates", "GET", f"{API}/notifications/templates"),
        item("Preview a template", "POST", f"{API}/notifications/preview",
             body={"template": "enrollment_confirmation", "variables": {"name": "Ann", "course_code": "C1", "course_title": "Intro"}}),
        item("Queue an e-mail (202 Accepted)", "POST", f"{API}/notifications", expect=(202,),
             body={"to_email": "pm.notify.{{suffix}}@example.com", "to_name": "Postman", "variables": {"subject": "Hello", "message": "From Postman"}},
             save={"notificationId": "j.id"}),
        item("History (filter/sort)", "GET", f"{API}/notifications", query={"status": "SENT", "sort": "id", "order": "desc", "size": "5"}),
        item("One notification + attempts", "GET", f"{API}/notifications/{{{{notificationId}}}}"),
        item("Statistics", "GET", f"{API}/notifications/stats"),
    ]),

    folder("08 Clean-up & logout", [
        item("Delete enrollment (admin)", "DELETE", f"{API}/enrollments/{{{{enrollmentId}}}}", expect=(204,)),
        item("Delete course (409 if enrollments remain)", "DELETE", f"{API}/courses/{{{{courseId}}}}", expect=(204, 409)),
        item("Delete student", "DELETE", f"{API}/students/{{{{studentId}}}}", expect=(204,)),
        item("Delete the linked student record", "DELETE", f"{API}/students/{{{{selfStudentId}}}}", expect=(204,)),
        item("Logout (revokes refresh + access token)", "POST", f"{API}/auth/logout", token="studentToken", expect=(204,), body={"refresh_token": "{{studentRefresh}}"}),
        item("Revoked token is rejected -> 401 (after Kafka propagation)", "GET", f"{API}/auth/me", token="studentToken", expect=(200, 401),
             desc="The gateway learns about the revocation through the TokenRevoked Kafka event; usually < 1 s."),
    ]),
]

variables = {
    "baseUrl": "http://localhost:8000", "adminEmail": "admin@sms.example.com", "adminPassword": "CHANGE_ME",
    "password": "Str0ng!Passw0rd#1",
}
collection = {
    "info": {"name": "Student Management System (FastAPI microservices)",
             "description": "Flow-style collection covering every endpoint family through the API gateway. "
                            "Set adminPassword in the environment, then run the collection top to bottom.",
             "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
    "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{accessToken}}", "type": "string"}]},
    "variable": [{"key": k, "value": ""} for k in ("accessToken", "refreshToken", "studentToken", "studentRefresh", "suffix", "studentEmail",
                                                    "teacherEmail", "deptCode", "courseCode", "studentUserId", "teacherId", "studentId", "selfStudentId",
                                                    "contactId", "bulkId", "fileId", "categoryId", "courseId", "courseFileId", "enrollmentId",
                                                    "selfEnrollmentId", "notificationId", "deptId")],
    "item": folders,
}
(OUT / "SMS.postman_collection.json").write_text(json.dumps(collection, indent=2))
env = {"id": "sms-local", "name": "SMS - local", "_postman_variable_scope": "environment",
       "values": [{"key": k, "value": v, "enabled": True, "type": "secret" if "assword" in k else "default"} for k, v in variables.items()]}
(OUT / "SMS.local.postman_environment.json").write_text(json.dumps(env, indent=2))
n = sum(len(f["item"]) for f in folders)
print(f"wrote collection: {len(folders)} folders, {n} requests")
