using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Data;
using HR.ProjectService.Data;
using HR.ProjectService.DTOs;
using HR.ProjectService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ProjectService.Services;

/// <summary>customers.tax_number is encrypted by the Java service; it is excluded from every DTO and never read or written here.</summary>
public sealed class CustomerService(ProjectDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Customer, CustomerRequest, CustomerDto>(db, audit, cache)
{
    protected override string Label => "Customer";
    protected override string[] SortFields => ["Name", "Code", "CreatedAt"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "Code", "Industry"];

    protected override async Task BeforeCreateAsync(Customer e, CustomerRequest r, CancellationToken ct)
    {
        if (await db.Customers.IgnoreQueryFilters().AnyAsync(c => c.Code == e.Code, ct)) throw new ConflictException("Customer code already exists");
    }
    protected override async Task BeforeUpdateAsync(Customer e, CustomerRequest r, CancellationToken ct)
    {
        if (await db.Customers.IgnoreQueryFilters().AnyAsync(c => c.Code == e.Code && c.Id != e.Id, ct)) throw new ConflictException("Customer code already exists");
    }
    protected override async Task BeforeDeleteAsync(Customer e, CancellationToken ct)
    {
        if (await db.Projects.AnyAsync(p => p.CustomerId == e.Id && (p.Status == "PLANNED" || p.Status == "ACTIVE" || p.Status == "ON_HOLD"), ct)) throw new BusinessRuleException("Customer still has open projects");
    }
}

public interface IContactService
{
    Task<CustomerDetailDto> DetailAsync(string customerId, CancellationToken ct);
    Task<List<ContactDto>> ListAsync(string customerId, CancellationToken ct);
    Task<ContactDto> AddAsync(string customerId, ContactRequest r, CancellationToken ct);
    Task<ContactDto> UpdateAsync(string customerId, string id, ContactRequest r, CancellationToken ct);
    Task DeleteAsync(string customerId, string id, CancellationToken ct);
}

public sealed class ContactService(ProjectDbContext db, IUnitOfWork uow) : IContactService
{
    private static ContactDto ToDto(CustomerContact c) => new(c.Id, c.Name, c.Email, c.Phone, c.Designation, c.IsPrimary);

    public async Task<CustomerDetailDto> DetailAsync(string customerId, CancellationToken ct)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == customerId, ct) ?? throw new NotFoundException("Customer not found");
        var dto = new CustomerDto { Id = c.Id, CreatedAt = c.CreatedAt, UpdatedAt = c.UpdatedAt, BillingAddress = c.BillingAddress, BillingEmail = c.BillingEmail, Code = c.Code, CreditLimit = c.CreditLimit, Industry = c.Industry,
            Name = c.Name, Notes = c.Notes, PaymentTermsDays = c.PaymentTermsDays, Status = c.Status, Website = c.Website };
        var contacts = await ListAsync(customerId, ct);
        var projects = await db.Projects.AsNoTracking().Where(p => p.CustomerId == customerId).OrderByDescending(p => p.StartDate).Select(p => new CustomerProjectItem(p.Id, p.Code, p.Name, p.Status)).ToListAsync(ct);
        return new CustomerDetailDto(dto, contacts, projects);
    }

    public async Task<List<ContactDto>> ListAsync(string customerId, CancellationToken ct) =>
        (await db.CustomerContacts.AsNoTracking().Where(c => c.CustomerId == customerId).OrderBy(c => c.CreatedAt).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<ContactDto> AddAsync(string customerId, ContactRequest r, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == customerId, ct)) throw new NotFoundException("Customer not found");
        var c = new CustomerContact { CustomerId = customerId, Name = r.Name, Email = r.Email, Phone = r.Phone, Designation = r.Designation, IsPrimary = r.Primary };
        await uow.ExecuteAsync(async () =>
        {
            if (r.Primary) await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = {customerId}", ct);
            db.CustomerContacts.Add(c);
            await db.SaveChangesAsync(ct);
        }, ct);
        return ToDto(c);
    }

    public async Task<ContactDto> UpdateAsync(string customerId, string id, ContactRequest r, CancellationToken ct)
    {
        var c = await db.CustomerContacts.FirstOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct) ?? throw new BusinessRuleException("Contact does not belong to this customer");
        await uow.ExecuteAsync(async () =>
        {
            if (r.Primary) await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = {customerId} AND id <> {id}", ct);
            c.Name = r.Name; c.Email = r.Email ?? c.Email; c.Phone = r.Phone ?? c.Phone; c.Designation = r.Designation ?? c.Designation; c.IsPrimary = r.Primary;
            await db.SaveChangesAsync(ct);
        }, ct);
        return ToDto(c);
    }

    public async Task DeleteAsync(string customerId, string id, CancellationToken ct)
    {
        var c = await db.CustomerContacts.FirstOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct) ?? throw new BusinessRuleException("Contact does not belong to this customer");
        c.Deleted = true; c.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
