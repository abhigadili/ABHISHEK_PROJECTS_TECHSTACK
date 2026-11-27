#!/usr/bin/env python3
"""Cleans a mysqldump --no-data file into a Flyway baseline: drops MySQL conditional comments, guards foreign keys
(tables are dumped alphabetically, so a FK may reference a table created later) and normalises blank lines."""
import re, sys
p = sys.argv[1]
lines = [l for l in open(p).read().split('\n') if not l.startswith('/*!')]
head, _, rest = '\n'.join(lines).partition('\n\n')
body = re.sub(r'\n{3,}', '\n\n', rest).strip()
open(p, 'w').write(head + "\n\n-- tables are listed alphabetically, so foreign keys may point at tables created later in this file\n"
                   "SET FOREIGN_KEY_CHECKS = 0;\n\n" + body + "\n\nSET FOREIGN_KEY_CHECKS = 1;\n")
