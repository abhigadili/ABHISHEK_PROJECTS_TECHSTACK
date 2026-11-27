# One Dockerfile for every service: docker build --build-arg PROJECT=src/Services/Auth/HR.AuthService --build-arg ASSEMBLY=HR.AuthService .
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG PROJECT
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src ./src
RUN dotnet publish ${PROJECT} -c Release -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
ARG ASSEMBLY
ENV ASSEMBLY_NAME=${ASSEMBLY} ASPNETCORE_ENVIRONMENT=Production DOTNET_RUNNING_IN_CONTAINER=true
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /app/storage /app/logs
ENTRYPOINT ["sh", "-c", "exec dotnet ${ASSEMBLY_NAME}.dll"]
