using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HR.Common.Common;
using HR.Common.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Logging;
using Polly;

namespace HR.Common.Http;

/// <summary>DelegatingHandler (HttpClient pipeline): forwards the caller's bearer token and the correlation id to the downstream service.</summary>
public sealed class HeaderPropagationHandler(ICurrentUser user, ILogger<HeaderPropagationHandler> log) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (user.Token is { } t && request.Headers.Authorization is null) request.Headers.Authorization = new("Bearer", t);
        var cid = CorrelationContext.Id ?? CorrelationContext.NewId();
        request.Headers.TryAddWithoutValidation(CorrelationContext.HeaderName, cid);
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        var response = await base.SendAsync(request, ct);
        log.LogInformation("HTTP {Method} {Host}{Path} -> {Status} in {Elapsed:0} ms", request.Method, request.RequestUri?.Authority, request.RequestUri?.AbsolutePath, (int)response.StatusCode,
            System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        return response;
    }
}

/// <summary>Base for typed clients (IHttpClientFactory): JSON in/out against the standard envelope with uniform error mapping.</summary>
public abstract class ServiceClientBase(HttpClient http)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter(), new FlexibleTimeOnlyConverter() } };

    protected async Task<T?> GetAsync<T>(string path, CancellationToken ct = default) where T : class => await SendAsync<T>(HttpMethod.Get, path, null, ct);
    protected Task<T?> PostAsync<T>(string path, object? body, CancellationToken ct = default) where T : class => SendAsync<T>(HttpMethod.Post, path, body, ct);
    protected Task<T?> PutAsync<T>(string path, object? body, CancellationToken ct = default) where T : class => SendAsync<T>(HttpMethod.Put, path, body, ct);
    protected Task<T?> PatchAsync<T>(string path, object? body, CancellationToken ct = default) where T : class => SendAsync<T>(HttpMethod.Patch, path, body, ct);
    protected Task<T?> DeleteAsync<T>(string path, CancellationToken ct = default) where T : class => SendAsync<T>(HttpMethod.Delete, path, null, ct);

    protected async Task<T?> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct) where T : class
    {
        using var req = new HttpRequestMessage(method, path);
        if (body is not null) req.Content = JsonContent.Create(body, options: Json);
        HttpResponseMessage res;
        try { res = await http.SendAsync(req, ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or Polly.Timeout.TimeoutRejectedException)
        {
            if (ct.IsCancellationRequested) throw;
            throw new DependencyUnavailableException($"Downstream service unavailable ({http.BaseAddress?.Authority}): {ex.GetType().Name}");
        }
        using (res)
        {
            if (res.IsSuccessStatusCode)
            {
                if (res.StatusCode == HttpStatusCode.NoContent) return null;
                var envelope = await res.Content.ReadFromJsonAsync<Envelope<T>>(Json, ct);
                return envelope?.Data;
            }
            var err = await TryReadError(res, ct);
            if (res.StatusCode == HttpStatusCode.NotFound) throw new NotFoundException(err.Message);
            if ((int)res.StatusCode is >= 400 and < 500) throw new DownstreamRejectedException(res.StatusCode, err.Code, err.Message);
            throw new DependencyUnavailableException($"Downstream service failed ({(int)res.StatusCode}): {err.Message}");
        }
    }

    private static async Task<(string Code, string Message)> TryReadError(HttpResponseMessage res, CancellationToken ct)
    {
        try
        {
            var e = await res.Content.ReadFromJsonAsync<ErrorEnvelope>(Json, ct);
            return (e?.Error?.Code ?? "DOWNSTREAM_ERROR", e?.Error?.Message ?? res.ReasonPhrase ?? "error");
        }
        catch { return ("DOWNSTREAM_ERROR", res.ReasonPhrase ?? "error"); }
    }

    private sealed record Envelope<T>(bool Success, T? Data);
    private sealed record ErrorEnvelope(ErrorBody? Error);
    private sealed record ErrorBody(string? Code, string? Message);
}

/// <summary>Paged payload as returned by list endpoints of the other services.</summary>
public sealed record PagedPayload<T>(List<T> Items, int Page, int Size, long Total, int TotalPages);

public static class HttpClientRegistration
{
    /// <summary>Registers a typed client with env-based base URL, timeout, header propagation and a resilience pipeline (retry only for idempotent GETs + circuit breaker).</summary>
    public static IHttpClientBuilder AddHrClient<TInterface, TImpl>(this IServiceCollection services, string baseUrl, int timeoutSeconds = 8)
        where TInterface : class where TImpl : class, TInterface
    {
        services.AddTransient<HeaderPropagationHandler>();
        var builder = services.AddHttpClient<TInterface, TImpl>(c => { c.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"); c.Timeout = TimeSpan.FromSeconds(timeoutSeconds * 3); })
            .AddHttpMessageHandler<HeaderPropagationHandler>();
        builder.AddResilienceHandler("hr-pipeline", p =>
        {
            p.AddTimeout(TimeSpan.FromSeconds(timeoutSeconds));
            p.AddRetry(new HttpRetryStrategyOptions
            {
                MaxRetryAttempts = 2, Delay = TimeSpan.FromMilliseconds(200), BackoffType = DelayBackoffType.Exponential,
                ShouldHandle = args => ValueTask.FromResult(
                    args.Outcome.Result?.RequestMessage?.Method == HttpMethod.Get &&
                    (args.Outcome.Exception is HttpRequestException || (int?)args.Outcome.Result?.StatusCode >= 500))
            });
            p.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions { FailureRatio = 0.7, MinimumThroughput = 10, SamplingDuration = TimeSpan.FromSeconds(30), BreakDuration = TimeSpan.FromSeconds(15) });
        });
        return builder;
    }
}
