using HMS.Pharmacy.Clients;
using HMS.Pharmacy.Data;
using HMS.Pharmacy.Domain;
using HMS.Pharmacy.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Pharmacy.Services;

public interface IPharmacyAppService
{
    Task<MedicineResponse> AddMedicineAsync(MedicineRequest r, CancellationToken ct);
    Task<MedicineResponse> UpdateMedicineAsync(long id, MedicineRequest r, CancellationToken ct);
    Task<MedicineResponse> RestockAsync(long id, int qty, CancellationToken ct);
    Task<List<MedicineResponse>> ListMedicinesAsync(CancellationToken ct);
    Task OpenOrderAsync(PrescriptionCreated e, CancellationToken ct);
    Task<OrderResponse> DispenseAsync(long orderId, CancellationToken ct);
    Task<OrderResponse> RejectAsync(long orderId, string reason, CancellationToken ct);
    Task<OrderResponse> OrderAsync(long id, CancellationToken ct);
    Task<OrderResponse> OrderByPrescriptionAsync(long prescriptionId, CancellationToken ct);
    Task<PageResponse<OrderResponse>> OrdersAsync(OrderStatus? status, int page, int size, CancellationToken ct);
}

public sealed class PharmacyAppService(PharmacyDbContext db, IPrescriptionDirectory prescriptions, IEventPublisher events, ICurrentUser user, ILogger<PharmacyAppService> log) : IPharmacyAppService
{
    // ---- inventory ---------------------------------------------------------------------------------------

    public async Task<MedicineResponse> AddMedicineAsync(MedicineRequest r, CancellationToken ct)
    {
        if (await db.Medicines.AnyAsync(m => m.Sku == r.Sku, ct)) throw new ConflictException($"SKU '{r.Sku}' already exists");
        var m = new Medicine();
        Apply(m, r);
        db.Medicines.Add(m);
        await db.SaveChangesAsync(ct);
        return MedicineResponse.From(m);
    }

    public async Task<MedicineResponse> UpdateMedicineAsync(long id, MedicineRequest r, CancellationToken ct)
    {
        var m = await db.Medicines.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException($"Medicine {id} not found");
        if (m.Sku != r.Sku && await db.Medicines.AnyAsync(x => x.Sku == r.Sku, ct)) throw new ConflictException($"SKU '{r.Sku}' already exists");
        Apply(m, r);
        await db.SaveChangesAsync(ct);
        return MedicineResponse.From(m);
    }

    public async Task<MedicineResponse> RestockAsync(long id, int qty, CancellationToken ct)
    {
        Medicine? result = null;
        await db.InTransactionAsync(async () =>
        {
            var m = await LockAsync(id, ct) ?? throw new NotFoundException($"Medicine {id} not found");
            m.StockQuantity += qty;
            if (m.StockQuantity > m.ReorderLevel) m.LastLowStockAlertAt = null;
            await db.SaveChangesAsync(ct);
            result = m;
        }, ct);
        return MedicineResponse.From(result!);
    }

    public async Task<List<MedicineResponse>> ListMedicinesAsync(CancellationToken ct) =>
        (await db.Medicines.AsNoTracking().Where(m => m.Active).OrderBy(m => m.Name).ToListAsync(ct)).Select(MedicineResponse.From).ToList();

    // ---- prescription events -> orders --------------------------------------------------------------------

    /// <summary>Consumer of PrescriptionCreated: opens a PENDING order, pre-matching each line to inventory by name/generic name.</summary>
    public async Task OpenOrderAsync(PrescriptionCreated e, CancellationToken ct)
    {
        if (await db.Orders.AnyAsync(o => o.PrescriptionId == e.PrescriptionId, ct)) { log.LogInformation("Pharmacy order for prescription {PrescriptionId} already exists", e.PrescriptionId); return; }
        var o = new PharmacyOrder { PrescriptionId = e.PrescriptionId, PatientId = e.PatientId, PatientName = e.PatientName, PatientEmail = e.PatientEmail, DoctorName = e.DoctorName };
        foreach (var i in e.Items)
        {
            var item = new PharmacyOrderItem { MedicineName = i.MedicineName, Dosage = i.Dosage, Quantity = i.Quantity };
            var match = await FindMatchAsync(i.MedicineName, ct);
            if (match is not null) { item.MedicineId = match.Id; item.UnitPrice = match.UnitPrice; }
            o.Items.Add(item);
        }
        db.Orders.Add(o);
        await db.SaveChangesAsync(ct);
        log.LogInformation("Pharmacy order {OrderId} opened for prescription {PrescriptionId} ({Lines} lines)", o.Id, e.PrescriptionId, o.Items.Count);
    }

    // ---- dispensing ----------------------------------------------------------------------------------------

    public async Task<OrderResponse> DispenseAsync(long orderId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, ct) ?? throw new NotFoundException($"Pharmacy order {orderId} not found");
        if (order.Status != OrderStatus.PENDING) throw new ConflictException($"Order {orderId} is already {order.Status}");
        var rx = await prescriptions.StatusAsync(order.PrescriptionId, ct);                    // gRPC
        if (rx.Status != "ACTIVE") throw new ConflictException($"Prescription {order.PrescriptionId} is {rx.Status} and cannot be dispensed");

        PharmacyOrder? result = null;
        await db.InTransactionAsync(async () =>
        {
            db.ChangeTracker.Clear();
            var o = await db.Orders.Include(x => x.Items).FirstAsync(x => x.Id == orderId, ct);
            if (o.Status != OrderStatus.PENDING) throw new ConflictException($"Order {orderId} is already {o.Status}");
            // verify EVERYTHING before changing anything; stock rows are locked (SELECT ... FOR UPDATE) in id order to avoid deadlocks
            var problems = new List<string>();
            foreach (var i in o.Items)
            {
                if (i.MedicineId is null)
                {
                    var match = await FindMatchAsync(i.MedicineName, ct);
                    if (match is not null) { i.MedicineId = match.Id; i.UnitPrice = match.UnitPrice; }
                }
                if (i.MedicineId is null) problems.Add($"{i.MedicineName}: not in inventory");
            }
            var locked = new Dictionary<long, Medicine>();
            foreach (var id in o.Items.Where(i => i.MedicineId is not null).Select(i => i.MedicineId!.Value).Distinct().OrderBy(x => x))
                locked[id] = (await LockAsync(id, ct))!;
            foreach (var i in o.Items.Where(i => i.MedicineId is not null))
            {
                var need = o.Items.Where(x => x.MedicineId == i.MedicineId).Sum(x => x.Quantity);
                if (locked[i.MedicineId!.Value].StockQuantity < need) problems.Add($"{i.MedicineName}: need {need}, only {locked[i.MedicineId!.Value].StockQuantity} in stock");
            }
            if (problems.Count > 0) throw new ConflictException("Cannot dispense - " + string.Join("; ", problems.Distinct()));

            decimal total = 0;
            var sold = new List<DispensedItem>();
            foreach (var i in o.Items)
            {
                var m = locked[i.MedicineId!.Value];
                m.StockQuantity -= i.Quantity;
                i.UnitPrice = m.UnitPrice;
                total += m.UnitPrice * i.Quantity;
                sold.Add(new DispensedItem(i.MedicineName, i.Quantity, m.UnitPrice));
            }
            o.Status = OrderStatus.DISPENSED;
            o.TotalAmount = total;
            o.DispensedBy = user.Username;
            o.DispensedAt = DateTime.UtcNow;
            events.Publish(Topics.MedicineDispensed, o.Id.ToString(), new MedicineDispensed(o.Id, o.PrescriptionId, o.PatientId, o.PatientName, o.PatientEmail, total, sold));
            await db.SaveChangesAsync(ct);
            result = o;
        }, ct);
        log.LogInformation("Order {OrderId} dispensed by {User} total {Total}", orderId, result!.DispensedBy, result.TotalAmount);
        return await OrderAsync(orderId, ct);
    }

    public async Task<OrderResponse> RejectAsync(long orderId, string reason, CancellationToken ct)
    {
        var o = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == orderId, ct) ?? throw new NotFoundException($"Pharmacy order {orderId} not found");
        if (o.Status != OrderStatus.PENDING) throw new ConflictException($"Order {orderId} is already {o.Status}");
        o.Status = OrderStatus.REJECTED;
        o.RejectionReason = reason;
        await db.SaveChangesAsync(ct);
        return OrderResponse.From(o);
    }

    public async Task<OrderResponse> OrderAsync(long id, CancellationToken ct) =>
        OrderResponse.From(await db.Orders.AsNoTracking().Include(o => o.Items).ThenInclude(i => i.Medicine).FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw new NotFoundException($"Pharmacy order {id} not found"));

    public async Task<OrderResponse> OrderByPrescriptionAsync(long prescriptionId, CancellationToken ct) =>
        OrderResponse.From(await db.Orders.AsNoTracking().Include(o => o.Items).ThenInclude(i => i.Medicine).FirstOrDefaultAsync(o => o.PrescriptionId == prescriptionId, ct)
                           ?? throw new NotFoundException($"No pharmacy order for prescription {prescriptionId}"));

    public async Task<PageResponse<OrderResponse>> OrdersAsync(OrderStatus? status, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var q = db.Orders.AsNoTracking().Include(o => o.Items).ThenInclude(i => i.Medicine).AsQueryable();
        if (status is not null) q = q.Where(o => o.Status == status);
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(o => o.CreatedAt).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<OrderResponse>(rows.Select(OrderResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    private Task<Medicine?> LockAsync(long id, CancellationToken ct) =>
        db.Medicines.FromSqlInterpolated($"SELECT * FROM hdn_medicines WHERE Id = {id} FOR UPDATE").FirstOrDefaultAsync(ct);

    private async Task<Medicine?> FindMatchAsync(string name, CancellationToken ct)
    {
        var n = name.Trim().ToLower();
        return await db.Medicines.Where(m => m.Active && (m.Name.ToLower() == n || (m.GenericName != null && m.GenericName.ToLower() == n))).OrderByDescending(m => m.StockQuantity).FirstOrDefaultAsync(ct);
    }

    private static void Apply(Medicine m, MedicineRequest r)
    {
        m.Sku = r.Sku.Trim(); m.Name = r.Name.Trim(); m.GenericName = r.GenericName; m.UnitPrice = r.UnitPrice!.Value; m.StockQuantity = r.StockQuantity!.Value;
        if (r.ReorderLevel is not null) m.ReorderLevel = r.ReorderLevel.Value;
    }
}

public sealed class PrescriptionCreatedHandler(IPharmacyAppService svc) : KafkaEventHandler<PrescriptionCreated>
{
    public override string Topic => Topics.PrescriptionCreated;
    protected override Task HandleAsync(PrescriptionCreated e, CancellationToken ct) => svc.OpenOrderAsync(e, ct);
}

/// <summary>Hosted scheduler: one NotificationRequested per low-stock medicine per alert interval.</summary>
public sealed class LowStockJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<LowStockJob> log)
    : PeriodicJob(scopes, cfg, log, "low-stock-alerts", "Scheduler:LowStockIntervalSeconds", 600)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<PharmacyDbContext>();
        var events = sp.GetRequiredService<IEventPublisher>();
        var before = DateTime.UtcNow - TimeSpan.FromHours(cfg.GetValue("Pharmacy:AlertIntervalHours", 24));
        var alertEmail = cfg["Pharmacy:AlertEmail"] ?? "pharmacy.admin@hospital.local";
        var low = await db.Medicines.Where(m => m.Active && m.StockQuantity <= m.ReorderLevel && (m.LastLowStockAlertAt == null || m.LastLowStockAlertAt < before)).ToListAsync(ct);
        foreach (var m in low)
        {
            events.Publish(Topics.NotificationRequested, $"low-stock-{m.Id}", new NotificationRequested(alertEmail, null, "EMAIL", $"Low stock: {m.Name}",
                $"{m.Name} ({m.Sku}) has only {m.StockQuantity} unit(s) left (reorder level {m.ReorderLevel}).", "LOW_STOCK", m.Id.ToString()));
            m.LastLowStockAlertAt = DateTime.UtcNow;
        }
        if (low.Count > 0) { await db.SaveChangesAsync(ct); log.LogInformation("Low-stock job: {Count} alert(s) queued", low.Count); }
    }
}

public static class MedicineSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PharmacyDbContext>();
        if (await db.Medicines.AnyAsync()) return;
        db.Medicines.AddRange(M("MED-PARA500", "Paracetamol 500mg", "Paracetamol", 2.50m, 500), M("MED-AMOX500", "Amoxicillin 500mg", "Amoxicillin", 8.00m, 300),
            M("MED-IBU400", "Ibuprofen 400mg", "Ibuprofen", 4.00m, 400), M("MED-METF500", "Metformin 500mg", "Metformin", 3.50m, 350),
            M("MED-ATOR10", "Atorvastatin 10mg", "Atorvastatin", 6.00m, 250), M("MED-CETI10", "Cetirizine 10mg", "Cetirizine", 1.50m, 600));
        await db.SaveChangesAsync();
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Seeder").LogInformation("Seeded 6 medicines");
    }

    private static Medicine M(string sku, string name, string generic, decimal price, int stock) => new() { Sku = sku, Name = name, GenericName = generic, UnitPrice = price, StockQuantity = stock };
}
