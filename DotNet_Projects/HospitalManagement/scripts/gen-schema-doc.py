#!/usr/bin/env python3
"""Generates the table-by-table part of the database documentation from information_schema (read-only, hdn_* tables only)."""
import os, subprocess
env = dict(os.environ, MYSQL_PWD=os.environ["MYSQL_PASSWORD"])
base = ["mysql", "-h", os.environ.get("MYSQL_HOST", "localhost"), "-P", os.environ.get("MYSQL_PORT", "3306"), "-u", os.environ.get("MYSQL_USER", "abhig"), "-N", "-B", "-e"]
def q(sql): return [l.split("\t") for l in subprocess.run(base + [sql], env=env, capture_output=True, text=True, check=True).stdout.splitlines()]
DBS = [("HospitalDB", "Hospital Service"), ("PatientDB", "Patient Service"), ("DoctorDB", "Doctor Service"), ("AppointmentDB", "Appointment Service"), ("MedicalRecordsDB", "Medical Records Service"),
       ("PrescriptionDB", "Prescription Service"), ("LaboratoryDB", "Laboratory Service"), ("BillingDB", "Billing Service"), ("PharmacyDB", "Pharmacy Service"), ("NotificationDB", "Notification Service")]
out = []
for db, svc in DBS:
    out.append(f"## {db} - {svc}\n")
    for (t,) in q(f"select table_name from information_schema.tables where table_schema='{db}' and table_name like 'hdn\\_%' order by table_name"):
        out.append(f"### `{db}.{t}`\n")
        out.append("| Column | Type | Null | Key / extra |\n|---|---|---|---|")
        for c, typ, nul, key, extra in q(f"select column_name, column_type, is_nullable, column_key, extra from information_schema.columns where table_schema='{db}' and table_name='{t}' order by ordinal_position"):
            out.append(f"| `{c}` | `{typ}` | {nul} | {' '.join(x for x in [key, extra] if x)} |")
        out.append("")
        idx = q(f"select index_name, group_concat(column_name order by seq_in_index), non_unique from information_schema.statistics where table_schema='{db}' and table_name='{t}' and index_name<>'PRIMARY' group by index_name, non_unique order by index_name")
        fks = q(f"select constraint_name, column_name, referenced_table_name, referenced_column_name from information_schema.key_column_usage where table_schema='{db}' and table_name='{t}' and referenced_table_name is not null")
        if idx: out.append("**Indexes / unique constraints:** " + "; ".join(f"`{i}` ({'unique ' if nu == '0' else ''}{cols})" for i, cols, nu in idx) + "\n")
        if fks: out.append("**Foreign keys (same database only):** " + "; ".join(f"`{n}`: {c} -> {rt}.{rc}" for n, c, rt, rc in fks) + "\n")
print("\n".join(out))
