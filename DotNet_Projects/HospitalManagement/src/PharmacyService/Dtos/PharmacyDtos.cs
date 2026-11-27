using System.ComponentModel.DataAnnotations;
using HMS.Pharmacy.Domain;

namespace HMS.Pharmacy.Dtos;

public sealed class MedicineRequest
{
    [Required, StringLength(40)] public string Sku { get; set; } = "";
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [StringLength(150)] public string? GenericName { get; set; }
    [Required, Range(0.01, 1000000)] public decimal? UnitPrice { get; set; }
    [Required, Range(0, 10000000)] public int? StockQuantity { get; set; }
    [Range(0, 10000000)] public int? ReorderLevel { get; set; }
}

public sealed class RestockRequest { [Required, Range(1, 10000000)] public int? Quantity { get; set; } }
public sealed class RejectRequest { [Required, StringLength(255)] public string Reason { get; set; } = ""; }

public sealed record MedicineResponse(long Id, string Sku, string Name, string? GenericName, decimal UnitPrice, int StockQuantity, int ReorderLevel, bool Active)
{
    public static MedicineResponse From(Medicine m) => new(m.Id, m.Sku, m.Name, m.GenericName, m.UnitPrice, m.StockQuantity, m.ReorderLevel, m.Active);
}

public sealed record OrderItemResponse(string MedicineName, string? Dosage, int Quantity, long? MedicineId, decimal? UnitPrice, bool InStock);

public sealed record OrderResponse(long Id, long PrescriptionId, long PatientId, string PatientName, string? DoctorName, OrderStatus Status, decimal TotalAmount, string? DispensedBy,
    DateTime? DispensedAt, string? RejectionReason, DateTime CreatedAt, List<OrderItemResponse> Items)
{
    public static OrderResponse From(PharmacyOrder o) => new(o.Id, o.PrescriptionId, o.PatientId, o.PatientName, o.DoctorName, o.Status, o.TotalAmount, o.DispensedBy, o.DispensedAt, o.RejectionReason, o.CreatedAt,
        o.Items.Select(i => new OrderItemResponse(i.MedicineName, i.Dosage, i.Quantity, i.MedicineId, i.UnitPrice, i.Medicine is not null && i.Medicine.StockQuantity >= i.Quantity)).ToList());
}
