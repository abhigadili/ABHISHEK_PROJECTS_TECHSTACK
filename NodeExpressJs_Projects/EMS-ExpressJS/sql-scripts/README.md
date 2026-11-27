# EMS-ExpressJS SQL scripts

Target: **MySQL 8.0.16+** (CHECK constraints, recursive CTEs). Database: `ems_expressjs`.
Every script is idempotent where noted and only touches `ems_expressjs`.

| Order | Script | Purpose |
|---|---|---|
| 1 | `01_create_database.sql` | Creates the `ems_expressjs` database (needs CREATE privilege) |
| 2 | `02_create_tables.sql` | All tables, PKs, unique and CHECK constraints (`IF NOT EXISTS`) |
| 3 | `03_create_indexes_and_constraints.sql` | Foreign keys + secondary indexes (**run once**; re-running errors on duplicates) |
| 4 | `04_create_views.sql` | `v_leave_balance_available`, `v_department_headcount` (used by the app) |
| 5 | `07_seed_reference_data.sql` | **Required**: roles, leave types/policies, weekly offs |
| 6 | `08_seed_sample_employees.sql` | *Optional, dev only*: 12 fictional employees, org tree, holidays |
| – | `09_sample_queries_and_reports.sql` | Read-only example queries (search, org chart, attendance, leave) |
| – | `10_database_validation_queries.sql` | Integrity checks; each query must return 0 rows |

There are no stored procedures or triggers (creating triggers needs SUPER when binary logging is on, which an app user should not require): all business rulesdeduction, attendance) live in the service layer inside transactions, backed by the constraints above.
Numbers 05/06 are intentionally unused. "Not your own manager" is enforced in the service layer and verified by the first query of `10_database_validation_queries.sql`.

## Run with the MySQL client

```bash
cd sql-scripts
mysql -u <user> -p < 01_create_database.sql
for f in 02_create_tables 03_create_indexes_and_constraints 04_create_views 07_seed_reference_data 08_seed_sample_employees; do
  mysql -u <user> -p ems_expressjs < $f.sql
done
```
(or `npm run db:init` which does the same with the credentials in `.env`; `npm run db:init -- --no-sample` skips script 08.)

## Run with DBeaver

1. Connect to MySQL, open an SQL editor (Ctrl+]) on the connection.
2. Open each script (File → Open File), choose **Execute Script** (Alt+X), in the order above.
3. Refresh the navigator; `ems_expressjs` should show the tables.

## Administrator account

No password is stored in SQL. Create the first administrator with the Node CLI:

```bash
ADMIN_EMAIL=admin@company.example ADMIN_PASSWORD='S0me-Strong-Pass!' npm run admin:create
```

## Cleanup / rollback

Only ever against the dedicated database:

```sql
-- DESTRUCTIVE: removes ALL EMS data. Verify the schema name first.
SELECT DATABASE();            -- must print ems_expressjs
DROP DATABASE ems_expressjs;  -- then re-run the scripts above
```
To remove only the sample data, delete the rows with `employee_code LIKE 'EMP-10%'` (after removing their dependent rows), or just rebuild.
