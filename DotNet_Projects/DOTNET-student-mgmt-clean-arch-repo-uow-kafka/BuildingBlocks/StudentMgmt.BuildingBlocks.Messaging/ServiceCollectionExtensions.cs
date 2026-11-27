using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StudentMgmt.BuildingBlocks.Messaging;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="KafkaSettings"/> (Options Pattern), the Singleton
    /// event producer and the Singleton dead-letter publisher. Call once from
    /// each microservice's Program.cs; register topic-specific
    /// <see cref="KafkaConsumerBase"/> subclasses separately with
    /// <c>AddHostedService&lt;TConsumer&gt;()</c>.
    /// </summary>
    public static IServiceCollection AddKafkaMessaging(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<KafkaSettings>(configuration.GetSection(KafkaSettings.SectionName));
        services.AddSingleton<IEventProducer, KafkaEventProducer>();
        services.AddSingleton<IDeadLetterPublisher, DeadLetterPublisher>();
        return services;
    }
}
