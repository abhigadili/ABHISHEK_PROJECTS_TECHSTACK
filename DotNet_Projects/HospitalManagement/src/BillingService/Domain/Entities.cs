namespace HMS.Billing.Domain;

public enum BillStatus { PENDING, PAID, OVERDUE, CANCELLED }
public enum BillType { APPOINTMENT, LAB, MEDICINE, OTHER }
public enum PaymentStatus { PENDING, SUCCESS, FAILED }
/// <summary>Only the method is recorded - card numbers / CVV / UPI PINs are never accepted or stored.</summary>
public enum PaymentMethod { CARD, UPI, NET_BANKING, CASH, INSURANCE }

/// <summary>The unique (ReferenceType, ReferenceId) makes bill generation from Kafka events naturally idempotent.</summary>
public class Bill
{
    public long Id { get; set; }
    public string BillNumber { get; set; } = "";
    public long PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientEmail { get; set; }
    public BillType BillType { get; set; }
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
    public BillStatus Status { get; set; } = BillStatus.PENDING;
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public DateOnly DueDate { get; set; }
    public DateTime? LastReminderAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<BillItem> Items { get; set; } = [];
    public List<Payment> Payments { get; set; } = [];

    public decimal Outstanding => TotalAmount - PaidAmount;
    public void AddItem(string description, int quantity, decimal unitPrice)
    {
        Items.Add(new BillItem { Description = description, Quantity = quantity, UnitPrice = unitPrice, Amount = unitPrice * quantity });
        TotalAmount += unitPrice * quantity;
    }
}

public class BillItem
{
    public long Id { get; set; }
    public long BillId { get; set; }
    public Bill? Bill { get; set; }
    public string Description { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}

public class Payment
{
    public long Id { get; set; }
    public long BillId { get; set; }
    public Bill? Bill { get; set; }
    public string TransactionRef { get; set; } = "";
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.PENDING;
    /// <summary>Equals BillId while the payment is PENDING, NULL afterwards. A unique index on it guarantees at most one in-flight payment per bill, even under concurrency.</summary>
    public long? ActiveBillId { get; set; }
    public string? FailureReason { get; set; }
    public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
