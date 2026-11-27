#!/usr/bin/env bash
# Adapts the freshly scaffolded model: bit(1) -> bool, contexts derive from HrDbContext (outbox/inbox, concurrency, soft-delete filter).
set -euo pipefail
cd "$(dirname "$0")/.."
files=$(grep -rl ulong src/Services --include=*.cs || true)
[ -n "$files" ] && sed -i -E 's/public ulong(\??) /public bool\1 /' $files
sed -i 's/\xEF\xBB\xBF//' $(find src/Services -name '*.cs')
while IFS=$'\t' read -r n db port; do
  f=src/Services/$n/HR.${n}Service/Data/${n}DbContext.cs
  sed -i "s/public partial class ${n}DbContext : DbContext/public partial class ${n}DbContext : HR.Common.Data.HrDbContext/" $f
  cat > src/Services/$n/HR.${n}Service/Data/${n}DbContext.Conventions.cs <<EOT
using Microsoft.EntityFrameworkCore;

namespace HR.${n}Service.Data;

public partial class ${n}DbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
EOT
done < scripts/services.tsv
