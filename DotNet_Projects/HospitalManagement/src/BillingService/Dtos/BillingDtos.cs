using System.ComponentModel.DataAnnotations;
using HMS.Billing.Domain;

namespace HMS.Billing.Dtos;

public sealed class ItemRequest
{
    [Required, StringLength(200)] public string Description { get; set; } = "";
    [Required, Range(1, 100000)] public int? Quantity { get; set; }
    [Required, Range(0.01, 100000000)] public decimal? UnitPrice { get; set; }
}

public sealed class BillRequest
{
    [Required] public long? PatientId { get; set; }
    [Required] public BillType? BillType { get; set; }
    /// <summary>Optional link to the thing being billed (e.g. the appointment id for APPOINTMENT bills).</summary>
    public long? ReferenceId { get; set; }
    [StringLength(255)] public string? Note { get; set; }
    [Required, MinLength(1, ErrorMessage = "at least one item is required")] public List<ItemRequest> Items { get; set; } = [];
}

public enum Outcome { SUCCESS, FAILURE }

public sealed class PaymentRequest
{
    [Required] public PaymentMethod? Method { get; set; }
    /// <summary>Test hook of the simulated gateway: SUCCESS / FAILURE settle immediately; omitted = stays PENDING until confirmed.</summary>
    public Outcome? SimulateOutcome { get; set; }
}

public sealed class PaymentStatusUpdate
{
    [Required] public PaymentStatus? Status { get; set; }
    [StringLength(255)] public string? FailureReason { get; set; }
}

public sealed record ItemResponse(string Description, int Quantity, decimal UnitPrice, decimal Amount);

public sealed record BillResponse(long Id, string BillNumber, long PatientId, string PatientName, BillType BillType, string? ReferenceType, long? ReferenceId, BillStatus Status,
    decimal TotalAmount, decimal PaidAmount, string Currency, DateOnly DueDate, string? Note, DateTime CreatedAt, List<ItemResponse> Items)
{
    public static BillResponse From(Bill b) => new(b.Id, b.BillNumber, b.PatientId, b.PatientName, b.BillType, b.ReferenceType, b.ReferenceId, b.Status, b.TotalAmount, b.PaidAmount, b.Currency,
        b.DueDate, b.Note, b.CreatedAt, b.Items.Select(i => new ItemResponse(i.Description, i.Quantity, i.UnitPrice, i.Amount)).ToList());
}

public sealed record PaymentResponse(long Id, long BillId, string BillNumber, string TransactionRef, decimal Amount, PaymentMethod Method, PaymentStatus Status, string? FailureReason,
    DateTime InitiatedAt, DateTime? CompletedAt)
{
    public static PaymentResponse From(Payment p, string billNumber) => new(p.Id, p.BillId, billNumber, p.TransactionRef, p.Amount, p.Method, p.Status, p.FailureReason, p.InitiatedAt, p.CompletedAt);
}
