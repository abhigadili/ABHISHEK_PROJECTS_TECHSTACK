using HMS.Billing.Clients;
using HMS.Billing.Data;
using HMS.Billing.Domain;
using HMS.Billing.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Billing.Services;

/// <summary>Stand-in for a real payment gateway (none is configured). It never sees card data: it only decides the outcome.</summary>
public sealed class PaymentGatewaySimulator
{
    public enum Result { Success, Failure, Undecided }
    public Result Authorise(PaymentMethod method, Outcome? forced) => forced switch { Outcome.SUCCESS => Result.Success, Outcome.FAILURE => Result.Failure, _ => Result.Undecided };
}

public interface IBillingAppService
{
    Task<BillResponse> CreateManualAsync(BillRequest r, CancellationToken ct);
    Task GenerateFromEventAsync(BillType type, string referenceType, long referenceId, long patientId, string patientName, string? email, string description, decimal unitPrice, int quantity, CancellationToken ct);
    Task GenerateMedicineBillAsync(MedicineDispensed e, CancellationToken ct);
    Task OnAppointmentCancelledAsync(long appointmentId, CancellationToken ct);
    Task<PaymentResponse> InitiatePaymentAsync(long billId, PaymentRequest r, CancellationToken ct);
    Task<PaymentResponse> UpdatePaymentStatusAsync(string transactionRef, PaymentStatusUpdate u, CancellationToken ct);
    Task SettleAsync(Payment p, PaymentStatus outcome, string? reason, CancellationToken ct);
    Task<BillResponse> CancelAsync(long billId, CancellationToken ct);
    Task<BillResponse> GetAsync(long id, CancellationToken ct);
    Task<List<BillResponse>> ForPatientAsync(long patientId, CancellationToken ct);
    Task<PageResponse<BillResponse>> ListAsync(BillStatus? status, int page, int size, CancellationToken ct);
    Task<List<PaymentResponse>> PaymentsOfAsync(long billId, CancellationToken ct);
    Task<PaymentResponse> PaymentAsync(string transactionRef, CancellationToken ct);
}

public sealed class BillingAppService(BillingDbContext db, IPatientDirectory patients, IAppointmentDirectory appointments, PaymentGatewaySimulator simulator,
    IEventPublisher events, ICurrentUser user, IConfiguration cfg, ILogger<BillingAppService> log) : IBillingAppService
{
    private int DueDays => cfg.GetValue("Billing:DueDays", 7);

    // ---- bill generation ------------------------------------------------------------------------------------

    /// <summary>Manual bill raised by billing staff; an APPOINTMENT bill is verified against the Appointment Service (HttpClient).</summary>
    public async Task<BillResponse> CreateManualAsync(BillRequest r, CancellationToken ct)
    {
        var patient = await patients.GetAsync(r.PatientId!.Value, ct);                    // gRPC
        string? refType = r.BillType != BillType.OTHER && r.ReferenceId is not null ? r.BillType.ToString() : null;
        if (r.BillType == BillType.APPOINTMENT)
        {
            if (r.ReferenceId is null) throw new BadRequestException("referenceId (appointment id) is required for APPOINTMENT bills");
            var appt = await appointments.GetAsync(r.ReferenceId.Value, ct);
            if (appt.PatientId != patient.Id) throw new BadRequestException($"Appointment {appt.Id} does not belong to patient {patient.Id}");
            if (appt.Status == "CANCELLED") throw new BadRequestException($"Appointment {appt.Id} is cancelled");
        }
        if (refType is not null && await db.Bills.AnyAsync(b => b.ReferenceType == refType && b.ReferenceId == r.ReferenceId, ct))
            throw new ConflictException($"A {refType} bill already exists for reference {r.ReferenceId}");
        var b = NewBill(patient.Id, patient.FullName, patient.Email, r.BillType!.Value, refType, refType is null ? null : r.ReferenceId, r.Note);
        foreach (var i in r.Items) b.AddItem(i.Description, i.Quantity!.Value, i.UnitPrice!.Value);
        try { await PersistAndAnnounceAsync(b, ct); }
        catch (DbUpdateException) { throw new ConflictException("A bill already exists for this reference"); }
        return BillResponse.From(b);
    }

    /// <summary>Called from Kafka consumers; the unique (ReferenceType, ReferenceId) guarantees one bill per business object.</summary>
    public async Task GenerateFromEventAsync(BillType type, string referenceType, long referenceId, long patientId, string patientName, string? email, string description, decimal unitPrice, int quantity, CancellationToken ct)
    {
        if (unitPrice <= 0) { log.LogInformation("No billable amount for {RefType} #{RefId} - bill not created", referenceType, referenceId); return; }
        if (await db.Bills.AnyAsync(x => x.ReferenceType == referenceType && x.ReferenceId == referenceId, ct)) { log.LogInformation("Bill for {RefType} #{RefId} already exists - skipping", referenceType, referenceId); return; }
        var b = NewBill(patientId, patientName, email, type, referenceType, referenceId, $"Auto-generated from {referenceType} #{referenceId}");
        b.AddItem(description, quantity, unitPrice);
        await PersistAndAnnounceAsync(b, ct);
    }

    /// <summary>Medicines: one line per dispensed item.</summary>
    public async Task GenerateMedicineBillAsync(MedicineDispensed e, CancellationToken ct)
    {
        if (e.TotalAmount <= 0 || await db.Bills.AnyAsync(x => x.ReferenceType == "PHARMACY_ORDER" && x.ReferenceId == e.OrderId, ct)) return;
        var b = NewBill(e.PatientId, e.PatientName, e.PatientEmail, BillType.MEDICINE, "PHARMACY_ORDER", e.OrderId, $"Medicines dispensed for prescription #{e.PrescriptionId}");
        foreach (var i in e.Items) b.AddItem(i.MedicineName, i.Quantity, i.UnitPrice);
        await PersistAndAnnounceAsync(b, ct);
    }

    /// <summary>Compensating action: an unpaid appointment bill is cancelled when its appointment is cancelled.</summary>
    public async Task OnAppointmentCancelledAsync(long appointmentId, CancellationToken ct)
    {
        var b = await db.Bills.FirstOrDefaultAsync(x => x.ReferenceType == "APPOINTMENT" && x.ReferenceId == appointmentId, ct);
        if (b is null) return;
        if (b.Status is BillStatus.PENDING or BillStatus.OVERDUE)
        {
            b.Status = BillStatus.CANCELLED;
            b.Note = $"Cancelled because appointment {appointmentId} was cancelled";
            await db.SaveChangesAsync(ct);
            log.LogInformation("Bill {BillNumber} cancelled (appointment {AppointmentId} cancelled)", b.BillNumber, appointmentId);
        }
        else if (b.Status == BillStatus.PAID)
        {
            b.Note = $"Appointment {appointmentId} was cancelled after payment - REFUND REQUIRED";
            await db.SaveChangesAsync(ct);
            log.LogWarning("Bill {BillNumber} is already PAID but appointment {AppointmentId} was cancelled: manual refund required", b.BillNumber, appointmentId);
        }
    }

    private Bill NewBill(long patientId, string patientName, string? email, BillType type, string? refType, long? refId, string? note) => new()
    {
        BillNumber = "TMP-" + Guid.NewGuid().ToString("N"), PatientId = patientId, PatientName = patientName, PatientEmail = email, BillType = type,
        ReferenceType = refType, ReferenceId = refId, Note = note, DueDate = DateOnly.FromDateTime(DateTime.Now).AddDays(DueDays)
    };

    private async Task PersistAndAnnounceAsync(Bill b, CancellationToken ct)
    {
        await db.InTransactionAsync(async () =>
        {
            db.Bills.Add(b);
            await db.SaveChangesAsync(ct);
            b.BillNumber = $"BILL-{DateTime.Now:yyyyMMdd}-{b.Id:D6}";
            events.Publish(Topics.BillingGenerated, b.Id.ToString(), new BillingGenerated(b.Id, b.BillNumber, b.PatientId, b.PatientName, b.PatientEmail, b.BillType.ToString(),
                b.ReferenceType, b.ReferenceId, b.TotalAmount, b.DueDate));
            await db.SaveChangesAsync(ct);
        }, ct);
        log.LogInformation("Bill {BillNumber} generated: {Amount} {Currency} for patient {PatientId}", b.BillNumber, b.TotalAmount, b.Currency, b.PatientId);
    }

    // ---- payments (Scenario 6) ------------------------------------------------------------------------------

    public async Task<PaymentResponse> InitiatePaymentAsync(long billId, PaymentRequest r, CancellationToken ct)
    {
        var b = await FindBillAsync(billId, ct);
        await GuardAsync(b, ct);
        if (b.Status == BillStatus.PAID) throw new ConflictException($"Bill {b.BillNumber} is already paid");
        if (b.Status == BillStatus.CANCELLED) throw new ConflictException($"Bill {b.BillNumber} is cancelled");
        var p = new Payment { BillId = b.Id, Method = r.Method!.Value, Amount = b.Outstanding, ActiveBillId = b.Id, TransactionRef = "TXN-" + Guid.NewGuid().ToString("N")[..20].ToUpperInvariant() };
        db.Payments.Add(p);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { throw new ConflictException("A payment for this bill is already in progress"); }   // unique ActiveBillId
        p.Bill = b;
        log.LogInformation("Payment {Ref} initiated for bill {BillNumber} amount {Amount} via {Method}", p.TransactionRef, b.BillNumber, p.Amount, p.Method);
        switch (simulator.Authorise(r.Method!.Value, r.SimulateOutcome))
        {
            case PaymentGatewaySimulator.Result.Success: await SettleAsync(p, PaymentStatus.SUCCESS, null, ct); break;
            case PaymentGatewaySimulator.Result.Failure: await SettleAsync(p, PaymentStatus.FAILED, "Declined by simulated gateway", ct); break;
        }
        return PaymentResponse.From(p, b.BillNumber);
    }

    public async Task<PaymentResponse> UpdatePaymentStatusAsync(string transactionRef, PaymentStatusUpdate u, CancellationToken ct)
    {
        var p = await db.Payments.Include(x => x.Bill).FirstOrDefaultAsync(x => x.TransactionRef == transactionRef, ct) ?? throw new NotFoundException($"Payment {transactionRef} not found");
        if (p.Status != PaymentStatus.PENDING) throw new ConflictException($"Payment {transactionRef} is already {p.Status}");
        if (u.Status == PaymentStatus.PENDING) throw new BadRequestException("status must be SUCCESS or FAILED");
        await SettleAsync(p, u.Status!.Value, u.FailureReason, ct);
        return PaymentResponse.From(p, p.Bill!.BillNumber);
    }

    /// <summary>Settles a PENDING payment, updates the bill and stages PaymentCompleted / PaymentFailed in the outbox (one transaction).</summary>
    public async Task SettleAsync(Payment p, PaymentStatus outcome, string? reason, CancellationToken ct)
    {
        var b = p.Bill ?? await db.Bills.FirstAsync(x => x.Id == p.BillId, ct);
        p.Status = outcome;
        p.ActiveBillId = null;
        p.CompletedAt = DateTime.UtcNow;
        if (outcome == PaymentStatus.SUCCESS)
        {
            b.PaidAmount += p.Amount;
            if (b.Outstanding <= 0) b.Status = BillStatus.PAID;
            events.Publish(Topics.PaymentCompleted, b.Id.ToString(), new PaymentCompleted(b.Id, b.BillNumber, p.TransactionRef, b.PatientId, b.PatientName, b.PatientEmail, b.ReferenceType, b.ReferenceId, p.Amount));
        }
        else
        {
            p.FailureReason = reason ?? "Payment failed";
            events.Publish(Topics.PaymentFailed, b.Id.ToString(), new PaymentFailed(b.Id, b.BillNumber, p.TransactionRef, b.PatientId, b.PatientName, b.PatientEmail, b.ReferenceType, b.ReferenceId, p.Amount, p.FailureReason));
        }
        b.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        log.LogInformation("Payment {Ref} -> {Outcome} (bill {BillNumber} now {Status})", p.TransactionRef, outcome, b.BillNumber, b.Status);
    }

    public async Task<BillResponse> CancelAsync(long billId, CancellationToken ct)
    {
        var b = await FindBillAsync(billId, ct);
        if (b.Status == BillStatus.PAID) throw new ConflictException("A paid bill cannot be cancelled");
        if (await db.Payments.AnyAsync(p => p.BillId == billId && p.Status == PaymentStatus.PENDING, ct)) throw new ConflictException("A payment is in progress for this bill");
        b.Status = BillStatus.CANCELLED;
        await db.SaveChangesAsync(ct);
        return BillResponse.From(b);
    }

    // ---- reads -----------------------------------------------------------------------------------------------

    public async Task<BillResponse> GetAsync(long id, CancellationToken ct)
    {
        var b = await FindBillAsync(id, ct);
        await GuardAsync(b, ct);
        return BillResponse.From(b);
    }

    public async Task<List<BillResponse>> ForPatientAsync(long patientId, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);
        return (await db.Bills.AsNoTracking().Include(b => b.Items).Where(b => b.PatientId == patientId).OrderByDescending(b => b.CreatedAt).ToListAsync(ct)).Select(BillResponse.From).ToList();
    }

    public async Task<PageResponse<BillResponse>> ListAsync(BillStatus? status, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var q = db.Bills.AsNoTracking().Include(b => b.Items).AsQueryable();
        if (status is not null) q = q.Where(b => b.Status == status);
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(b => b.CreatedAt).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<BillResponse>(rows.Select(BillResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<List<PaymentResponse>> PaymentsOfAsync(long billId, CancellationToken ct)
    {
        var b = await FindBillAsync(billId, ct);
        await GuardAsync(b, ct);
        return (await db.Payments.AsNoTracking().Where(p => p.BillId == billId).OrderByDescending(p => p.InitiatedAt).ToListAsync(ct)).Select(p => PaymentResponse.From(p, b.BillNumber)).ToList();
    }

    public async Task<PaymentResponse> PaymentAsync(string transactionRef, CancellationToken ct)
    {
        var p = await db.Payments.AsNoTracking().Include(x => x.Bill).FirstOrDefaultAsync(x => x.TransactionRef == transactionRef, ct) ?? throw new NotFoundException($"Payment {transactionRef} not found");
        await GuardAsync(p.Bill!, ct);
        return PaymentResponse.From(p, p.Bill!.BillNumber);
    }

    private async Task GuardAsync(Bill b, CancellationToken ct)
    {
        if (user.IsInRole(Roles.Patient) && !user.IsAdmin) await patients.RequireAccessAsync(b.PatientId, ct);
    }

    private async Task<Bill> FindBillAsync(long id, CancellationToken ct) =>
        await db.Bills.Include(b => b.Items).FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw new NotFoundException($"Bill {id} not found");
}
