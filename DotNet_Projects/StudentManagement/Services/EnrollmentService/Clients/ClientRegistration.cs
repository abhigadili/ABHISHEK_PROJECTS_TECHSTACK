using Microsoft.Extensions.Http.Resilience;
using Polly;

namespace EnrollmentService.Clients;

public static class ClientRegistration
{
    /// <summary>
    /// Registers StudentClient / CourseClient as typed HttpClients (IHttpClientFactory) with the service JWT handler and a resilience pipeline.
    /// Pipeline, outermost → innermost: total timeout → retry (exponential back-off + jitter) → circuit breaker → per-attempt timeout.
    /// Only technical failures (5xx, 408, 429, network) are retried / counted by the breaker: 404/409/4xx are business answers.
    /// </summary>
    public static IServiceCollection AddRemoteClients(this IServiceCollection services, IConfiguration cfg)
    {
        services.AddTransient<ServiceAuthHandler>();
        Add<IStudentClient, StudentClient>(services, cfg, "Student", "student-service");
        Add<ICourseClient, CourseClient>(services, cfg, "Course", "course-service");
        return services;
    }

    private static void Add<TI, TImpl>(IServiceCollection services, IConfiguration cfg, string urlKey, string name) where TI : class where TImpl : class, TI
    {
        services.AddHttpClient<TI, TImpl>(c => c.BaseAddress = new Uri(cfg[$"Services:{urlKey}"] ?? throw new InvalidOperationException($"Services:{urlKey} missing")))
            .AddHttpMessageHandler<ServiceAuthHandler>()
            .AddResilienceHandler(name, p =>
            {
                p.AddTimeout(TimeSpan.FromSeconds(cfg.GetValue("Resilience:TotalTimeoutSeconds", 12)));
                p.AddRetry(new HttpRetryStrategyOptions
                {
                    MaxRetryAttempts = cfg.GetValue("Resilience:RetryAttempts", 3),
                    Delay = TimeSpan.FromMilliseconds(cfg.GetValue("Resilience:RetryDelayMs", 300)),
                    BackoffType = DelayBackoffType.Exponential, UseJitter = true,
                });
                p.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
                {
                    SamplingDuration = TimeSpan.FromSeconds(cfg.GetValue("Resilience:BreakerSamplingSeconds", 30)),
                    MinimumThroughput = cfg.GetValue("Resilience:BreakerMinimumThroughput", 5),
                    FailureRatio = 0.5, BreakDuration = TimeSpan.FromSeconds(cfg.GetValue("Resilience:BreakerDurationSeconds", 10)),
                });
                p.AddTimeout(TimeSpan.FromSeconds(cfg.GetValue("Resilience:AttemptTimeoutSeconds", 4)));
            });
    }
}
