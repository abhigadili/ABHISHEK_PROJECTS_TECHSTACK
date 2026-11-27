namespace HR.AttendanceService.Services;

/// <summary>DATETIME columns hold UTC; shift rules are evaluated on office wall-clock time (configurable offset, IST = +330 minutes).</summary>
public sealed class OfficeTime(IConfiguration cfg)
{
    public int OffsetMinutes { get; } = cfg.GetValue("Attendance:OfficeOffsetMinutes", 330);
    public DateTime ToOffice(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc).AddMinutes(OffsetMinutes);
    public DateOnly DateOf(DateTime utc) => DateOnly.FromDateTime(ToOffice(utc));
    public DateOnly Today => DateOf(DateTime.UtcNow);
    public int MinuteOfDay(DateTime utc) { var o = ToOffice(utc); return o.Hour * 60 + o.Minute; }
    public static int Minutes(TimeOnly t) => t.Hour * 60 + t.Minute;
}
