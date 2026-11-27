namespace HMS.Pharmacy.Domain;

public enum OrderStatus { PENDING, DISPENSED, REJECTED }

public class Medicine
{
    public long Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string? GenericName { get; set; }
    public decimal UnitPrice { get; set; }
    public int StockQuantity { get; set; }
    public int ReorderLevel { get; set; } = 20;
    public bool Active { get; set; } = true;
    public DateTime? LastLowStockAlertAt { get; set; }
}

/// <summary>One order per prescription (unique PrescriptionId) - redelivered PrescriptionCreated events cannot create duplicates.</summary>
public class PharmacyOrder
{
    public long Id { get; set; }
    public long PrescriptionId { get; set; }
    public long PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientEmail { get; set; }
    public string? DoctorName { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PENDING;
    public decimal TotalAmount { get; set; }
    public string? DispensedBy { get; set; }
    public DateTime? DispensedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<PharmacyOrderItem> Items { get; set; } = [];
}

public class PharmacyOrderItem
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public PharmacyOrder? Order { get; set; }
    public string MedicineName { get; set; } = "";
    public string? Dosage { get; set; }
    public int Quantity { get; set; }
    /// <summary>Inventory item matched by name/generic name (null while no match exists).</summary>
    public long? MedicineId { get; set; }
    public Medicine? Medicine { get; set; }
    public decimal? UnitPrice { get; set; }
}
