using Grpc.Core;
using Grpc.Core.Interceptors;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;

namespace HMS.Shared.Grpc;

/// <summary>Client interceptor: forwards the caller's JWT and correlation id as gRPC metadata.</summary>
public sealed class GrpcHeadersInterceptor(IHttpContextAccessor accessor) : Interceptor
{
    public override AsyncUnaryCall<TResponse> AsyncUnaryCall<TRequest, TResponse>(TRequest request, ClientInterceptorContext<TRequest, TResponse> context,
        AsyncUnaryCallContinuation<TRequest, TResponse> continuation)
    {
        var headers = context.Options.Headers ?? [];
        var auth = accessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(auth) && headers.All(h => h.Key != "authorization")) headers.Add("authorization", auth);
        if (CorrelationContext.Id is { } id) headers.Add(CorrelationContext.HeaderName.ToLowerInvariant(), id);
        return continuation(request, new ClientInterceptorContext<TRequest, TResponse>(context.Method, context.Host, context.Options.WithHeaders(headers)));
    }
}

public static class GrpcResilience
{
    public const string Pipeline = "grpc";

    /// <summary>
    /// Polly pipeline for gRPC calls (all of them are read-only lookups, so they are safe to retry):
    /// retry on Unavailable/DeadlineExceeded -> circuit breaker -> overall timeout. NotFound/PermissionDenied are business answers, not failures.
    /// </summary>
    public static IServiceCollection AddGrpcResilience(this IServiceCollection services)
    {
        services.AddResiliencePipeline(Pipeline, b =>
        {
            b.AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 2,
                Delay = TimeSpan.FromMilliseconds(150),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                ShouldHandle = new PredicateBuilder().Handle<RpcException>(IsTransient)
            });
            b.AddCircuitBreaker(new CircuitBreakerStrategyOptions
            {
                SamplingDuration = TimeSpan.FromSeconds(30),
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                BreakDuration = TimeSpan.FromSeconds(15),
                ShouldHandle = new PredicateBuilder().Handle<RpcException>(IsTransient)
            });
            b.AddTimeout(TimeSpan.FromSeconds(8));
        });
        return services;
    }

    public static bool IsTransient(RpcException e) => e.StatusCode is StatusCode.Unavailable or StatusCode.DeadlineExceeded or StatusCode.Internal or StatusCode.Unknown;

    public static DateTime Deadline() => DateTime.UtcNow.AddSeconds(3);
}
