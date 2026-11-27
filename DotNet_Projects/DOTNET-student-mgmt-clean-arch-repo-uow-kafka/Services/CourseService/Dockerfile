FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["BuildingBlocks/StudentMgmt.BuildingBlocks.Contracts/StudentMgmt.BuildingBlocks.Contracts.csproj", "BuildingBlocks/StudentMgmt.BuildingBlocks.Contracts/"]
COPY ["BuildingBlocks/StudentMgmt.BuildingBlocks.Messaging/StudentMgmt.BuildingBlocks.Messaging.csproj", "BuildingBlocks/StudentMgmt.BuildingBlocks.Messaging/"]
COPY ["BuildingBlocks/StudentMgmt.BuildingBlocks.Common/StudentMgmt.BuildingBlocks.Common.csproj", "BuildingBlocks/StudentMgmt.BuildingBlocks.Common/"]
COPY ["Services/CourseService/CourseService.csproj", "Services/CourseService/"]
RUN dotnet restore "Services/CourseService/CourseService.csproj"
COPY BuildingBlocks/ BuildingBlocks/
COPY Services/CourseService/ Services/CourseService/
WORKDIR /src/Services/CourseService
RUN dotnet build "CourseService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CourseService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "CourseService.dll"]
