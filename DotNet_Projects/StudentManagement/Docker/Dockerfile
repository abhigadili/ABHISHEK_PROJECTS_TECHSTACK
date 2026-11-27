# syntax=docker/dockerfile:1.7
# One parameterised Dockerfile for all five programs. Build context = repository root:
#   docker build -f Docker/Dockerfile --build-arg PROJECT=Services/StudentService --build-arg ASSEMBLY=StudentService -t sms-dn/student-service .
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG PROJECT
WORKDIR /src
COPY . .
RUN dotnet publish "$PROJECT" -c Release -o /app/publish -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
ARG ASSEMBLY
WORKDIR /app
COPY --from=build /app/publish .
COPY Docker/healthcheck.sh /usr/local/bin/healthcheck
ENV ASPNETCORE_URLS=http://+:8080 DOTNET_gcServer=0 ASSEMBLY_NAME=${ASSEMBLY}
USER app
EXPOSE 8080
# liveness probe without curl/wget (not present in the aspnet image): plain bash TCP + HTTP request
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=6 CMD ["/usr/local/bin/healthcheck"]
ENTRYPOINT ["sh", "-c", "exec dotnet ${ASSEMBLY_NAME}.dll"]
