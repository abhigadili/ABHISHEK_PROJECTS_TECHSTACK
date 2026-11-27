using HR.Common.Messaging;
using HR.TaxService.Data;
using HR.TaxService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.TaxService.Consumers;

public sealed class TaxEmployeeReadModel(TaxDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.TaxEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new TaxEmployee { EmployeeId = e.EmployeeId }; db.TaxEmployees.Add(row); }
        row.FullName = e.FullName; row.Status = e.Status;
        await db.SaveChangesAsync(ct);
    }
}
