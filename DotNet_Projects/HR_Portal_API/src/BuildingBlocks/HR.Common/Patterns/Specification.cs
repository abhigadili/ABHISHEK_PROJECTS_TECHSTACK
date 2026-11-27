using System.Linq.Expressions;

namespace HR.Common.Patterns;

/// <summary>
/// Specification pattern: a named, composable business predicate that translates to SQL (expression tree), e.g. "active employees of a department".
/// Specifications are combined with And / Or / Not and applied with <c>query.Where(spec)</c> - the same rule is reused by list, report and export queries.
/// </summary>
public abstract class Specification<T>
{
    public abstract Expression<Func<T, bool>> ToExpression();

    public Specification<T> And(Specification<T> other) => new CombinedSpecification<T>(this, other, Expression.AndAlso);
    public Specification<T> Or(Specification<T> other) => new CombinedSpecification<T>(this, other, Expression.OrElse);
    public Specification<T> Not() => new NotSpecification<T>(this);

    public static implicit operator Expression<Func<T, bool>>(Specification<T> spec) => spec.ToExpression();
    public static Specification<T> All { get; } = new ExpressionSpecification<T>(_ => true);
}

public sealed class ExpressionSpecification<T>(Expression<Func<T, bool>> expression) : Specification<T>
{
    public override Expression<Func<T, bool>> ToExpression() => expression;
}

internal sealed class CombinedSpecification<T>(Specification<T> left, Specification<T> right, Func<Expression, Expression, BinaryExpression> combine) : Specification<T>
{
    public override Expression<Func<T, bool>> ToExpression()
    {
        var l = left.ToExpression(); var r = right.ToExpression();
        var p = Expression.Parameter(typeof(T), "x");
        var body = combine(new Rebind(l.Parameters[0], p).Visit(l.Body), new Rebind(r.Parameters[0], p).Visit(r.Body));
        return Expression.Lambda<Func<T, bool>>(body, p);
    }

    private sealed class Rebind(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }
}

internal sealed class NotSpecification<T>(Specification<T> inner) : Specification<T>
{
    public override Expression<Func<T, bool>> ToExpression()
    {
        var e = inner.ToExpression();
        return Expression.Lambda<Func<T, bool>>(Expression.Not(e.Body), e.Parameters);
    }
}

public static class SpecificationExtensions
{
    public static IQueryable<T> Where<T>(this IQueryable<T> query, Specification<T> spec) => query.Where(spec.ToExpression());
}
