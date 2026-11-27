namespace HR.PayrollService.Engine;

public enum LineType { EARNING, DEDUCTION }
public sealed record Line(string Code, string Name, LineType Type, decimal Amount, string? Note = null);
public sealed record StructureComponentInfo(string Code, string Name, LineType Type, string CalcType, decimal Value, int DisplayOrder);
public sealed record PtSlab(decimal? UpTo, decimal Amount);
public sealed record PayrollSettings(bool PfEnabled, decimal PfEmployeePercent, decimal PfWageCeiling, IReadOnlyList<PtSlab> PtSlabs, decimal StandardHoursPerDay, decimal OvertimeMultiplier);
public sealed record AttendanceFacts(decimal WorkingDays, decimal PaidDays, decimal LopDays, int OvertimeMinutes);
public sealed record AdjustmentInfo(string Type, decimal Amount, string? Description);
public sealed record EngineInput(decimal MonthlyCtc, IReadOnlyList<StructureComponentInfo> Components, PayrollSettings Settings, AttendanceFacts Attendance, decimal OvertimePay, decimal Tds,
    IReadOnlyList<AdjustmentInfo> Adjustments, decimal LoanEmi);

/// <summary>Calculation context shared by the strategies while one payslip is being built.</summary>
public sealed class CalcContext(EngineInput input)
{
    public EngineInput Input { get; } = input;
    public decimal MonthlyCtc => Input.MonthlyCtc;
    public decimal Basic { get; set; }
    public decimal Gross { get; set; }
    public decimal ProratedBasic { get; set; }
}

/// <summary>Strategy pattern: one implementation per calc_type of an earning component (full-month amount before proration).</summary>
public interface IEarningStrategy { string CalcType { get; } decimal Amount(StructureComponentInfo c, CalcContext x); }
public sealed class PercentOfCtcStrategy : IEarningStrategy { public string CalcType => "PERCENT_OF_CTC"; public decimal Amount(StructureComponentInfo c, CalcContext x) => x.MonthlyCtc * c.Value / 100; }
public sealed class PercentOfBasicStrategy : IEarningStrategy { public string CalcType => "PERCENT_OF_BASIC"; public decimal Amount(StructureComponentInfo c, CalcContext x) => x.Basic * c.Value / 100; }
public sealed class FixedStrategy : IEarningStrategy { public string CalcType => "FIXED"; public decimal Amount(StructureComponentInfo c, CalcContext x) => c.Value; }

/// <summary>Strategy per deduction calc_type; all statutory values come from payroll_config (PayrollSettings), never from code.</summary>
public interface IDeductionStrategy { string CalcType { get; } decimal Amount(StructureComponentInfo c, CalcContext x); }
public sealed class StatutoryPfStrategy : IDeductionStrategy
{
    public string CalcType => "STATUTORY_PF";
    public decimal Amount(StructureComponentInfo c, CalcContext x) => x.Input.Settings.PfEnabled ? Math.Min(x.ProratedBasic, x.Input.Settings.PfWageCeiling) * x.Input.Settings.PfEmployeePercent / 100 : 0;
}
public sealed class SlabPtStrategy : IDeductionStrategy
{
    public string CalcType => "SLAB_PT";
    public decimal Amount(StructureComponentInfo c, CalcContext x) => x.Input.Settings.PtSlabs.FirstOrDefault(s => s.UpTo is null || x.Gross <= s.UpTo)?.Amount ?? 0;
}
public sealed class TaxTdsStrategy : IDeductionStrategy { public string CalcType => "TAX_TDS"; public decimal Amount(StructureComponentInfo c, CalcContext x) => x.Input.Tds; }
public sealed class VariableDeductionStrategy : IDeductionStrategy
{
    public string CalcType => "VARIABLE";
    public decimal Amount(StructureComponentInfo c, CalcContext x) => x.Input.Adjustments.Where(a => a.Type == "OTHER_DEDUCTION").Sum(a => a.Amount);
}
public sealed class FixedDeductionStrategy : IDeductionStrategy { public string CalcType => "FIXED"; public decimal Amount(StructureComponentInfo c, CalcContext x) => c.Value; }

public interface ISalaryEngine
{
    List<Line> Calculate(EngineInput input);
    (decimal Gross, decimal Deductions, decimal Net) Totals(IEnumerable<Line> lines);
}

/// <summary>Configurable salary calculation engine: components come from the salary structure, rules from the strategies and payroll_config.</summary>
public sealed class SalaryEngine(IEnumerable<IEarningStrategy> earningStrategies, IEnumerable<IDeductionStrategy> deductionStrategies) : ISalaryEngine
{
    private readonly Dictionary<string, IEarningStrategy> _earn = earningStrategies.ToDictionary(s => s.CalcType);
    private readonly Dictionary<string, IDeductionStrategy> _ded = deductionStrategies.ToDictionary(s => s.CalcType);
    private static readonly Dictionary<string, string> EarningAdjustments = new() { ["BONUS"] = "Bonus", ["ALLOWANCE"] = "Allowance", ["ARREARS"] = "Arrears", ["REIMBURSEMENT"] = "Reimbursement", ["FINAL_SETTLEMENT"] = "Final settlement" };
    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public List<Line> Calculate(EngineInput input)
    {
        var att = input.Attendance;
        var factor = att.WorkingDays > 0 ? Math.Min(1m, Math.Max(0m, att.PaidDays / att.WorkingDays)) : 1m;
        var ordered = input.Components.OrderBy(c => c.DisplayOrder).ToList();
        var ctx = new CalcContext(input);
        var lines = new List<Line>();
        var full = new Dictionary<string, decimal>();
        decimal fixedEarnings = 0;

        // 1) derivable full-month earnings (percent of CTC first so BASIC is known, then percent-of-basic, fixed)
        foreach (var c in ordered.Where(c => c.Type == LineType.EARNING && c.CalcType == "PERCENT_OF_CTC"))
        {
            var amt = _earn["PERCENT_OF_CTC"].Amount(c, ctx);
            if (c.Code == "BASIC") ctx.Basic = amt;
            full[c.Code] = amt; fixedEarnings += amt;
        }
        if (ctx.Basic == 0 && full.TryGetValue("BASIC", out var b)) ctx.Basic = b;
        foreach (var c in ordered.Where(c => c.Type == LineType.EARNING && c.CalcType is "PERCENT_OF_BASIC" or "FIXED"))
        {
            var amt = _earn[c.CalcType].Amount(c, ctx);
            full[c.Code] = amt; fixedEarnings += amt;
        }
        // 2) the BALANCE component soaks up the rest of the monthly CTC
        foreach (var c in ordered.Where(c => c.Type == LineType.EARNING && c.CalcType == "BALANCE")) full[c.Code] = Math.Max(0, input.MonthlyCtc - fixedEarnings);

        foreach (var c in ordered.Where(c => c.Type == LineType.EARNING && full.ContainsKey(c.Code)))
            lines.Add(new Line(c.Code, c.Name, LineType.EARNING, R(full[c.Code] * factor), factor < 1 ? $"prorated {att.PaidDays}/{att.WorkingDays}" : null));
        ctx.ProratedBasic = R(ctx.Basic * factor);

        // 3) variable earnings: overtime + approved adjustments
        var ot = ordered.FirstOrDefault(c => c.CalcType == "VARIABLE" && c.Code == "OVERTIME");
        if (ot is not null && input.OvertimePay > 0) lines.Add(new Line(ot.Code, ot.Name, LineType.EARNING, R(input.OvertimePay), $"{att.OvertimeMinutes} min"));
        foreach (var a in input.Adjustments.Where(a => EarningAdjustments.ContainsKey(a.Type))) lines.Add(new Line(a.Type, EarningAdjustments[a.Type], LineType.EARNING, R(a.Amount), a.Description));
        ctx.Gross = R(lines.Sum(l => l.Amount));

        // 4) deductions depend on the computed basic / gross
        foreach (var c in ordered.Where(c => c.Type == LineType.DEDUCTION))
        {
            var amt = _ded.TryGetValue(c.CalcType, out var s) ? s.Amount(c, ctx) : 0;
            if (amt > 0) lines.Add(new Line(c.Code, c.Name, LineType.DEDUCTION, R(amt)));
        }
        if (input.LoanEmi > 0) lines.Add(new Line("LOAN", "Loan recovery", LineType.DEDUCTION, R(input.LoanEmi)));
        return lines;
    }

    public (decimal Gross, decimal Deductions, decimal Net) Totals(IEnumerable<Line> lines)
    {
        var all = lines.ToList();
        var gross = R(all.Where(l => l.Type == LineType.EARNING).Sum(l => l.Amount));
        var ded = R(all.Where(l => l.Type == LineType.DEDUCTION).Sum(l => l.Amount));
        return (gross, ded, R(gross - ded));
    }
}

public static class PayrollSettingsParser
{
    /// <summary>Builds the settings from payroll_config rows (latest effective value per key).</summary>
    public static PayrollSettings Parse(IReadOnlyDictionary<string, string> cfg)
    {
        decimal Num(string k, decimal d) => cfg.TryGetValue(k, out var v) && decimal.TryParse(v, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : d;
        var slabs = new List<PtSlab>();
        try
        {
            if (cfg.TryGetValue("statutory.pt.slabs", out var json))
                foreach (var el in System.Text.Json.JsonDocument.Parse(json).RootElement.EnumerateArray())
                    slabs.Add(new PtSlab(el.TryGetProperty("upTo", out var u) && u.ValueKind == System.Text.Json.JsonValueKind.Number ? u.GetDecimal() : null, el.GetProperty("amount").GetDecimal()));
        }
        catch (System.Text.Json.JsonException) { slabs.Clear(); }
        return new PayrollSettings(cfg.GetValueOrDefault("statutory.pf.enabled", "false") == "true", Num("statutory.pf.employee_percent", 0), Num("statutory.pf.wage_ceiling", decimal.MaxValue / 10),
            slabs, Num("payroll.standard_hours_per_day", 8), Num("overtime.multiplier", 2));
    }
}
