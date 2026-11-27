using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Polly;
using Polly.Retry;
using Polly.Timeout;

namespace HMS.Shared.Http;

/// <summary>Copies the caller's JWT and the correlation id onto every outgoing HttpClient request (so downstream RBAC still applies).</summary>
public sealed class DownstreamHeadersHandler(IHttpContextAccessor accessor) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var auth = accessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(auth) && request.Headers.Authorization is null)
            request.Headers.TryAddWithoutValidation("Authorization", auth);
        if (CorrelationContext.Id is { } id) request.Headers.TryAddWithoutValidation(CorrelationContext.HeaderName, id);
        return base.SendAsync(request, ct);
    }
}

public static class HttpClientExtensions
{
    /// <summary>
    /// Typed HttpClient registered through IHttpClientFactory with the platform's Polly (Microsoft.Extensions.Http.Resilience) pipeline:
    /// total timeout -> retry (idempotent GET/HEAD only, exponential back-off + jitter) -> circuit breaker -> per-attempt timeout.
    /// Unsafe methods (POST/PUT/PATCH/DELETE) are never retried automatically.
    /// </summary>
    public static IHttpClientBuilder AddHospitalHttpClient<TClient, TImpl>(this IServiceCollection services, string serviceName, string baseUrl)
        where TClient : class where TImpl : class, TClient
    {
        services.AddTransient<DownstreamHeadersHandler>();
        var builder = services.AddHttpClient<TClient, TImpl>(c => c.BaseAddress = new Uri(baseUrl))
            .AddHttpMessageHandler<DownstreamHeadersHandler>();
        builder.AddResilienceHandler($"{serviceName}-resilience", b =>
            {
                b.AddTimeout(new HttpTimeoutStrategyOptions { Timeout = TimeSpan.FromSeconds(12) });
                b.AddRetry(new HttpRetryStrategyOptions
                {
                    MaxRetryAttempts = 2,
                    Delay = TimeSpan.FromMilliseconds(200),
                    BackoffType = DelayBackoffType.Exponential,
                    UseJitter = true,
                    // only idempotent requests are retried automatically: POST/PUT/PATCH/DELETE are never replayed
                    ShouldHandle = args => ValueTask.FromResult(
                        args.Context.GetRequestMessage() is { Method: var m } && (m == HttpMethod.Get || m == HttpMethod.Head || m == HttpMethod.Options)
                        && HttpClientResiliencePredicates.IsTransient(args.Outcome))
                });
                b.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
                {
                    SamplingDuration = TimeSpan.FromSeconds(30),
                    FailureRatio = 0.5,
                    MinimumThroughput = 5,
                    BreakDuration = TimeSpan.FromSeconds(15)
                });
                b.AddTimeout(new HttpTimeoutStrategyOptions { Timeout = TimeSpan.FromSeconds(5) });   // per attempt
            });
        return builder;
    }
}

public static class DownstreamResponse
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter()  , new HMS.Shared.Common.FlexibleTimeOnlyConverter() } };

    /// <summary>Reads a JSON body or maps the HTTP error to a typed exception: 404 -> NotFound, other 4xx -> DownstreamClient, 5xx/timeouts/refused -> ServiceUnavailable.</summary>
    public static async Task<T> ReadAsync<T>(string service, Func<Task<HttpResponseMessage>> call, CancellationToken ct)
    {
        HttpResponseMessage resp;
        try { resp = await call(); }
        catch (Polly.CircuitBreaker.BrokenCircuitException) { throw; }
        catch (TimeoutRejectedException) { throw new ServiceUnavailableException($"{service} timed out"); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw new ServiceUnavailableException($"{service} is unreachable: {ex.GetType().Name}");
        }
        using (resp)
        {
            if (resp.IsSuccessStatusCode)
                return (await resp.Content.ReadFromJsonAsync<T>(Json, ct))!;
            var body = await resp.Content.ReadAsStringAsync(ct);
            var message = TryMessage(body);
            var code = (int)resp.StatusCode;
            if (code == 404) throw new NotFoundException(message ?? $"{service}: resource not found");
            if (code >= 500) throw new ServiceUnavailableException($"{service} failed with HTTP {code}" + (message is null ? "" : ": " + message));
            throw new DownstreamClientException(resp.StatusCode, message ?? $"{service} rejected the request (HTTP {code})");
        }
    }

    private static string? TryMessage(string body)
    {
        try { using var d = JsonDocument.Parse(body); return d.RootElement.TryGetProperty("message", out var m) ? m.GetString() : null; }
        catch { return null; }
    }
}
