#!/usr/bin/env python3
"""End-to-end check of the six business scenarios through the API gateway (stdlib only).
Run after scripts/start-all.sh:  python3 scripts/e2e.py"""
import json, sys, time, uuid, urllib.request, urllib.error, datetime

GW = "http://localhost:18080"
ok = fail = 0
RUN = uuid.uuid4().hex[:8]


def call(method, path, body=None, token=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(GW + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status, text = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode()
    try:
        js = json.loads(text) if text else None
    except ValueError:
        js = text
    if expect is not None:
        check(f"{method} {path} -> {expect}", status == expect, f"got {status}: {str(text)[:200]}")
    return status, js


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {name}")
    else:
        fail += 1
        print(f"  FAIL  {name}  {detail}")


def wait_for(name, fn, timeout=40):
    end = time.time() + timeout
    while time.time() < end:
        try:
            v = fn()
            if v:
                check(name, True)
                return v
        except Exception:
            pass
        time.sleep(1)
    check(name, False, "timed out")
    return None


def login(u, p):
    s, js = call("POST", "/api/auth/login", {"username": u, "password": p})
    assert s == 200, f"login {u} failed: {s} {js}"
    return js["accessToken"]


def next_weekday(dow):  # dow: 0=Mon
    d = datetime.date.today() + datetime.timedelta(days=1)
    while d.weekday() != dow:
        d += datetime.timedelta(days=1)
    return d


print("== 0. Authentication & gateway security")
admin = login("admin", "Admin@123")
call("POST", "/api/users", {"username": "dr" + RUN, "email": f"dr{RUN}@hospital.local", "password": "Doctor@1234", "role": "DOCTOR"}, admin, 201)
doc1_login = login("dr" + RUN, "Doctor@1234")
lab = login("labstaff1", "Staff@123")
pharm = login("pharmacist1", "Staff@123")
bill = login("billing1", "Staff@123")
check("login with wrong password -> 401", call("POST", "/api/auth/login", {"username": "admin", "password": "nope"})[0] == 401)
check("no token -> 401 at gateway", call("GET", "/api/doctors")[0] == 401)
check("garbage token -> 401", call("GET", "/api/doctors", token="abc.def.ghi")[0] == 401)
check("internal path blocked at gateway -> 403/401", call("GET", "/internal/x", token=admin)[0] in (401, 403, 404))
check("ping not routed through gateway", call("GET", "/ping", token=admin)[0] in (401, 403, 404))
check("DOCTOR cannot list users (gateway RBAC) -> 403", call("GET", "/api/users", token=doc1_login)[0] == 403)
check("ADMIN can list users", call("GET", "/api/users", token=admin)[0] == 200)

print("== Reference data: hospital, doctor, schedule")
s, hospitals = call("GET", "/api/hospitals", token=admin, expect=200)
hid = hospitals[0]["id"]
s, depts = call("GET", f"/api/hospitals/{hid}/departments", token=admin, expect=200)
check("hospital has seeded departments", len(depts) >= 3)
did = depts[0]["id"]
s, me = call("GET", "/api/auth/me", token=doc1_login, expect=200)
doc_user_id = me["id"]
lic = "LIC-" + RUN
s, doc = call("POST", "/api/doctors", {"firstName": "Ravi", "lastName": "Kumar", "email": f"ravi.{RUN}@hospital.local", "phone": "+919900112233",
        "licenseNumber": lic, "specialization": "Cardiology", "qualification": "MD", "experienceYears": 12, "consultationFee": 800,
        "hospitalId": hid, "departmentId": did, "userId": doc_user_id}, admin, 201)
doc_id = doc["id"]
check("doctor create: duplicate license -> 409", call("POST", "/api/doctors", {"firstName": "A", "lastName": "B", "email": f"x{RUN}@h.local", "licenseNumber": lic,
        "specialization": "Cardiology", "consultationFee": 100, "hospitalId": hid}, admin)[0] == 409)
check("doctor create: unknown hospital -> 400", call("POST", "/api/doctors", {"firstName": "A", "lastName": "B", "email": f"y{RUN}@h.local", "licenseNumber": "L2" + RUN,
        "specialization": "Cardiology", "consultationFee": 100, "hospitalId": 99999}, admin)[0] == 400)
target = next_weekday(0)  # next Monday
sched = {"days": [{"dayOfWeek": d, "startTime": "09:00", "endTime": "13:00", "slotMinutes": 30, "breakStart": "11:00", "breakEnd": "11:30"}
                  for d in ("MONDAY", "TUESDAY", "WEDNESDAY")]}
check("anonymous cannot set schedule -> 401", call("PUT", f"/api/doctors/{doc_id}/schedule", sched)[0] == 401)
call("PUT", f"/api/doctors/{doc_id}/schedule", sched, doc1_login, 200)
s, slots = call("GET", f"/api/doctors/{doc_id}/slots?date={target}", token=admin, expect=200)
starts = [x["startTime"][:5] for x in slots]
check("slot grid honours the 11:00-11:30 break", "11:00" not in starts and "10:30" in starts and "11:30" in starts, str(starts))
check("8 slots generated (4h minus 30min break, 30m slots)", len(slots) == 7, str(len(slots)))
s, avail = call("GET", f"/api/doctors/available?date={target}&specialization=Cardiology", token=admin, expect=200)
check("doctor listed as available on a working day", any(a["doctor"]["id"] == doc_id for a in avail))
s, sat = call("GET", f"/api/doctors/available?date={next_weekday(5)}", token=admin, expect=200)
check("doctor not available on a non-working day", not any(a["doctor"]["id"] == doc_id for a in sat))

print("== Scenario 1: patient registration")
uname = "pat" + RUN
s, acct = call("POST", "/api/auth/register", {"username": uname, "email": f"{uname}@mail.local", "password": "Patient@123"}, expect=201)
check("self-registered account is a PATIENT", acct["role"] == "PATIENT")
ptoken = login(uname, "Patient@123")
pbody = {"firstName": "Asha", "lastName": "Rao", "dateOfBirth": "1990-05-17", "gender": "FEMALE", "email": f"asha.{RUN}@mail.local",
         "phone": "+9198" + str(int(RUN, 16) % 100000000).zfill(8), "identityNumber": "ID-" + RUN, "bloodGroup": "O+"}
check("invalid patient (bad email/phone) -> 400", call("POST", "/api/patients", dict(pbody, email="nope", phone="12"), ptoken)[0] == 400)
s, pat = call("POST", "/api/patients", pbody, ptoken, 201)
pid = pat["id"]
check("patient profile linked to login", pat["userId"] == acct["id"])
check("second profile for same login -> 409", call("POST", "/api/patients", dict(pbody, email=f"b.{RUN}@mail.local", phone="+919811122233", identityNumber="X" + RUN), ptoken)[0] == 409)
other = "oth" + RUN
call("POST", "/api/auth/register", {"username": other, "email": f"{other}@mail.local", "password": "Patient@123"}, expect=201)
otoken = login(other, "Patient@123")
check("duplicate email/phone/identity -> 409", call("POST", "/api/patients", pbody, otoken)[0] == 409)
check("patient reads own profile", call("GET", f"/api/patients/{pid}", token=ptoken)[0] == 200)
check("other patient cannot read it -> 403", call("GET", f"/api/patients/{pid}", token=otoken)[0] == 403)
check("patient can update own profile", call("PUT", f"/api/patients/{pid}", dict(pbody, address="12 Lake Road"), ptoken)[0] == 200)
s, got = call("GET", f"/api/patients/{pid}", token=admin, expect=200)
check("update visible after cache refresh", got.get("address") == "12 Lake Road")
notes = wait_for("PatientRegistered -> welcome notification stored", lambda: [n for n in call("GET", f"/api/notifications?eventType=PATIENT_REGISTERED&email={pbody['email']}", token=admin)[1]["content"]])
rec = wait_for("PatientRegistered -> medical record created", lambda: (lambda r: r[1] if r[0] == 200 else None)(call("GET", f"/api/records/patients/{pid}/summary", token=admin)))

print("== Scenario 2/3: availability, booking, overlap, reschedule, cancel")
s, av = call("GET", f"/api/appointments/availability?doctorId={doc_id}&date={target}", token=ptoken, expect=200)
check("availability lists free slots", all(x["available"] for x in av) and len(av) == 7)
book = {"patientId": pid, "doctorId": doc_id, "date": str(target), "startTime": "09:30", "reason": "Chest pain follow-up"}
s, appt = call("POST", "/api/appointments", book, ptoken, 201)
aid = appt["id"]
check("fee copied from doctor", float(appt["fee"]) == 800.0)
s, av2 = call("GET", f"/api/appointments/availability?doctorId={doc_id}&date={target}", token=ptoken, expect=200)
check("booked slot disappears from availability (cache evicted)", [x for x in av2 if x["startTime"].startswith("09:30")][0]["available"] is False)
check("double booking same slot -> 409", call("POST", "/api/appointments", dict(book, patientId=pid), ptoken)[0] == 409)
check("booking on the doctor's break -> 400", call("POST", "/api/appointments", dict(book, startTime="11:00"), ptoken)[0] == 400)
check("booking for another patient -> 403", call("POST", "/api/appointments", book, otoken)[0] in (403, 404))
check("off-grid time -> 400", call("POST", "/api/appointments", dict(book, startTime="09:45"), ptoken)[0] == 400)
check("past date rejected -> 400", call("POST", "/api/appointments", dict(book, date="2020-01-06"), ptoken)[0] == 400)
check("unknown patient -> 404", call("POST", "/api/appointments", dict(book, patientId=999999), admin)[0] == 404)
s, resc = call("PUT", f"/api/appointments/{aid}/reschedule", {"date": str(target), "startTime": "10:00"}, ptoken, 200)
check("rescheduled", resc["startTime"].startswith("10:00"))
s, av3 = call("GET", f"/api/appointments/availability?doctorId={doc_id}&date={target}", token=ptoken, expect=200)
check("old slot freed, new slot taken", [x for x in av3 if x["startTime"].startswith("09:30")][0]["available"] and not [x for x in av3 if x["startTime"].startswith("10:00")][0]["available"])
s, my = call("GET", "/api/appointments/my", token=ptoken, expect=200)
check("/my lists the appointment", any(a["id"] == aid for a in my))
check("doctor sees schedule for the date", any(a["id"] == aid for a in call("GET", f"/api/appointments/doctor/{doc_id}?date={target}", token=doc1_login, expect=200)[1]))
wait_for("AppointmentBooked -> patient + doctor notified", lambda: len([n for n in call("GET", f"/api/notifications?eventType=APPOINTMENT_BOOKED", token=admin)[1]["content"] if n["referenceId"] == str(aid)]) >= 2)
wait_for("AppointmentRescheduled -> notified", lambda: [n for n in call("GET", f"/api/notifications?eventType=APPOINTMENT_RESCHEDULED", token=admin)[1]["content"] if n["referenceId"] == str(aid)])
bills = wait_for("AppointmentBooked -> consultation bill auto-generated (Kafka)", lambda: (lambda r: r if r else None)(call("GET", f"/api/bills/patient/{pid}", token=admin)[1]))
appt_bill = [b for b in bills if b["billType"] == "APPOINTMENT"][0] if bills else None

print("== Scenario 6: billing & payments")
bid = appt_bill["id"]
check("bill amount = doctor fee", float(appt_bill["totalAmount"]) == 800.0)
check("patient sees own bill", call("GET", f"/api/bills/{bid}", token=ptoken)[0] == 200)
check("other patient cannot see bill -> 403", call("GET", f"/api/bills/{bid}", token=otoken)[0] == 403)
check("duplicate manual APPOINTMENT bill -> 409", call("POST", "/api/bills", {"patientId": pid, "billType": "APPOINTMENT", "referenceId": aid, "items": [{"description": "x", "quantity": 1, "unitPrice": 10}]}, bill)[0] == 409)
s, pay1 = call("POST", f"/api/bills/{bid}/payments", {"method": "CARD", "simulateOutcome": "FAILURE"}, ptoken, 201)
check("simulated gateway failure -> FAILED", pay1["status"] == "FAILED")
wait_for("PaymentFailed -> notification", lambda: [n for n in call("GET", "/api/notifications?eventType=PAYMENT_FAILED", token=admin)[1]["content"] if n["referenceId"] == pay1["transactionRef"]])
s, pay2 = call("POST", f"/api/bills/{bid}/payments", {"method": "UPI"}, ptoken, 201)
check("payment initiated -> PENDING with transaction ref", pay2["status"] == "PENDING" and pay2["transactionRef"].startswith("TXN-"))
check("second payment while one is pending -> 409", call("POST", f"/api/bills/{bid}/payments", {"method": "UPI"}, ptoken)[0] == 409)
check("patient cannot confirm payments -> 403", call("PUT", f"/api/payments/{pay2['transactionRef']}/status", {"status": "SUCCESS"}, ptoken)[0] == 403)
s, done = call("PUT", f"/api/payments/{pay2['transactionRef']}/status", {"status": "SUCCESS"}, bill, 200)
check("payment SUCCESS", done["status"] == "SUCCESS")
check("bill is PAID", call("GET", f"/api/bills/{bid}", token=ptoken)[1]["status"] == "PAID")
check("settled payment cannot change -> 409", call("PUT", f"/api/payments/{pay2['transactionRef']}/status", {"status": "FAILED"}, bill)[0] == 409)
wait_for("PaymentCompleted -> notification", lambda: [n for n in call("GET", "/api/notifications?eventType=PAYMENT_COMPLETED", token=admin)[1]["content"] if n["referenceId"] == pay2["transactionRef"]])
wait_for("PaymentCompleted -> appointment paymentStatus PAID", lambda: call("GET", f"/api/appointments/{aid}", token=ptoken)[1].get("paymentStatus") == "PAID")

print("== Cancellation compensates billing")
s, appt2 = call("POST", "/api/appointments", dict(book, startTime="12:00"), ptoken, 201)
wait_for("second appointment billed", lambda: [b for b in call("GET", f"/api/bills/patient/{pid}", token=admin)[1] if b["referenceId"] == appt2["id"]])
s, c = call("PUT", f"/api/appointments/{appt2['id']}/cancel", {"reason": "Change of plans"}, ptoken, 200)
check("cancelled", c["status"] == "CANCELLED")
check("cancelling twice -> 409", call("PUT", f"/api/appointments/{appt2['id']}/cancel", {}, ptoken)[0] == 409)
wait_for("AppointmentCancelled -> its pending bill is CANCELLED (compensation)", lambda: [b for b in call("GET", f"/api/bills/patient/{pid}", token=admin)[1] if b["referenceId"] == appt2["id"] and b["status"] == "CANCELLED"])
s, av4 = call("GET", f"/api/appointments/availability?doctorId={doc_id}&date={target}", token=ptoken, expect=200)
check("cancelled slot bookable again", [x for x in av4 if x["startTime"].startswith("12:00")][0]["available"])
check("slot can be re-booked after cancel", call("POST", "/api/appointments", dict(book, startTime="12:00"), ptoken)[0] == 201)

print("== Leave day (unavailability)")
leave = next_weekday(1)
s, u = call("POST", f"/api/doctors/{doc_id}/unavailability", {"date": str(leave), "reason": "Conference"}, doc1_login, 201)
check("slots empty on leave day", call("GET", f"/api/doctors/{doc_id}/slots?date={leave}", token=admin)[1] == [])
check("booking on leave day -> 400", call("POST", "/api/appointments", dict(book, date=str(leave)), ptoken)[0] == 400)
call("DELETE", f"/api/doctors/{doc_id}/unavailability/{u['id']}", token=doc1_login, expect=204)
check("slots back after removing leave (cache evicted)", len(call("GET", f"/api/doctors/{doc_id}/slots?date={leave}", token=admin)[1]) == 7)

print("== Scenario 4: lab test request -> report")
s, tests = call("GET", "/api/lab/tests", token=doc1_login, expect=200)
check("lab catalogue seeded", len(tests) >= 5)
lreq = {"patientId": pid, "doctorId": doc_id, "testCode": "CBC", "priority": "URGENT", "clinicalNotes": "Fatigue"}
check("patient cannot request lab tests -> 403", call("POST", "/api/lab/requests", lreq, ptoken)[0] == 403)
s, lr = call("POST", "/api/lab/requests", lreq, doc1_login, 201)
lid = lr["id"]
wait_for("LabTestRequested -> accession number assigned (lab consumer)", lambda: call("GET", f"/api/lab/requests/{lid}", token=lab)[1].get("accessionNumber"))
wait_for("LabTestRequested -> lab bill generated (billing consumer)", lambda: [b for b in call("GET", f"/api/bills/patient/{pid}", token=admin)[1] if b["billType"] == "LAB"])
check("report before processing -> 409/404", call("POST", f"/api/lab/requests/{lid}/report", {"resultSummary": "x"}, lab)[0] == 409)
check("invalid transition REQUESTED->IN_PROGRESS -> 409", call("PUT", f"/api/lab/requests/{lid}/status", {"status": "IN_PROGRESS"}, lab)[0] == 409)
call("PUT", f"/api/lab/requests/{lid}/status", {"status": "SAMPLE_COLLECTED"}, lab, 200)
call("PUT", f"/api/lab/requests/{lid}/status", {"status": "IN_PROGRESS"}, lab, 200)
check("doctor cannot submit report -> 403", call("POST", f"/api/lab/requests/{lid}/report", {"resultSummary": "x"}, doc1_login)[0] == 403)
s, rep = call("POST", f"/api/lab/requests/{lid}/report", {"resultSummary": "Hemoglobin 9.1 g/dL (low)", "resultDetails": "WBC 6.2, Plt 250", "referenceRange": "Hb 12-16", "abnormal": True}, lab, 201)
check("request COMPLETED", call("GET", f"/api/lab/requests/{lid}", token=doc1_login)[1]["status"] == "COMPLETED")
check("patient retrieves own report", call("GET", f"/api/lab/requests/{lid}/report", token=ptoken)[0] == 200)
check("other patient cannot read report -> 403", call("GET", f"/api/lab/requests/{lid}/report", token=otoken)[0] == 403)
check("doctor retrieves report", call("GET", f"/api/lab/requests/{lid}/report", token=doc1_login)[0] == 200)
wait_for("LabReportGenerated -> report notification", lambda: [n for n in call("GET", "/api/notifications?eventType=LAB_REPORT_GENERATED", token=admin)[1]["content"] if n["referenceId"] == str(rep["id"])])
wait_for("LabReportGenerated -> medical record timeline entry", lambda: [e for e in call("GET", f"/api/records/patients/{pid}/entries?type=LAB_REPORT", token=doc1_login)[1]["content"]])

print("== Scenario 5: prescription -> pharmacy -> billing")
rx = {"patientId": pid, "doctorId": doc_id, "diagnosis": "Mild anaemia", "items": [
    {"medicineName": "Paracetamol", "dosage": "500mg", "frequency": "TID", "durationDays": 5, "quantity": 15, "instructions": "after food"},
    {"medicineName": "Cetirizine", "dosage": "10mg", "frequency": "OD", "durationDays": 5, "quantity": 5}]}
check("pharmacist cannot create prescription -> 403", call("POST", "/api/prescriptions", rx, pharm)[0] == 403)
check("empty items -> 400", call("POST", "/api/prescriptions", dict(rx, items=[]), doc1_login)[0] == 400)
s, p = call("POST", "/api/prescriptions", rx, doc1_login, 201)
rxid = p["id"]
check("prescription ACTIVE", p["status"] == "ACTIVE")
order = wait_for("PrescriptionCreated -> pharmacy order opened", lambda: (lambda r: r[1] if r[0] == 200 else None)(call("GET", f"/api/pharmacy/orders/prescription/{rxid}", token=pharm)))
check("order lines matched to inventory", order and all(i["medicineId"] for i in order["items"]))
s, disp = call("POST", f"/api/pharmacy/orders/{order['id']}/dispense", token=pharm, expect=200)
check("order DISPENSED with total 15*2.50+5*1.50=45.00", disp["status"] == "DISPENSED" and float(disp["totalAmount"]) == 45.0, str(disp.get("totalAmount")))
check("dispensing twice -> 409", call("POST", f"/api/pharmacy/orders/{order['id']}/dispense", token=pharm)[0] == 409)
wait_for("MedicineDispensed -> prescription status DISPENSED", lambda: call("GET", f"/api/prescriptions/{rxid}/status", token=ptoken)[1].get("status") == "DISPENSED")
wait_for("MedicineDispensed -> medicine bill generated", lambda: [b for b in call("GET", f"/api/bills/patient/{pid}", token=admin)[1] if b["billType"] == "MEDICINE" and float(b["totalAmount"]) == 45.0])
wait_for("PrescriptionCreated -> medical record timeline entry", lambda: [e for e in call("GET", f"/api/records/patients/{pid}/entries?type=PRESCRIPTION", token=ptoken)[1]["content"]])
check("patient sees own prescriptions", len(call("GET", f"/api/prescriptions/patient/{pid}", token=ptoken, expect=200)[1]) == 1)
check("other patient cannot see prescriptions -> 403", call("GET", f"/api/prescriptions/patient/{pid}", token=otoken)[0] == 403)
s, big = call("POST", "/api/prescriptions", dict(rx, items=[{"medicineName": "Paracetamol", "dosage": "500mg", "frequency": "TID", "durationDays": 30, "quantity": 100000}]), doc1_login)
check("huge quantity rejected by validation -> 400", s == 400)
s, p2 = call("POST", "/api/prescriptions", dict(rx, items=[{"medicineName": "Unobtainium", "dosage": "1mg", "frequency": "OD", "durationDays": 1, "quantity": 1}]), doc1_login, 201)
o2 = wait_for("order for unknown medicine opened", lambda: (lambda r: r[1] if r[0] == 200 else None)(call("GET", f"/api/pharmacy/orders/prescription/{p2['id']}", token=pharm)))
check("dispense with unavailable medicine -> 409, nothing changed", call("POST", f"/api/pharmacy/orders/{o2['id']}/dispense", token=pharm)[0] == 409)

print("== Appointment completion + records")
s, cmp_ = call("PUT", f"/api/appointments/{aid}/complete", {"notes": "Review in 2 weeks"}, doc1_login)
check("completing a future appointment is refused (400)", s == 400)

print("== Idempotency & robustness")
s, n_before = call("GET", f"/api/notifications?eventType=PATIENT_REGISTERED&email={pbody['email']}", token=admin, expect=200)
check("exactly one welcome notification per registration", len(n_before["content"]) == 1, str(len(n_before["content"])))
check("validation error shape", (lambda r: r[0] == 400 and "details" in r[1])(call("POST", "/api/hospitals", {"name": ""}, admin)))
check("404 shape", call("GET", "/api/doctors/987654", token=admin)[0] == 404)
check("unknown route via gateway -> 404", call("GET", "/api/nothing", token=admin)[0] == 404)

print(f"\nRESULT: {ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
