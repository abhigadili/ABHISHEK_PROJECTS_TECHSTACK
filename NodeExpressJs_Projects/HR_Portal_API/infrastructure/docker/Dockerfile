# One image for every service: docker build --build-arg SERVICE=auth-service -t hr-auth-service -f infrastructure/docker/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY common-library ./common-library
COPY auth-service ./auth-service
COPY employee-service ./employee-service
COPY organization-service ./organization-service
COPY leave-service ./leave-service
COPY attendance-service ./attendance-service
COPY holiday-service ./holiday-service
COPY payroll-service ./payroll-service
COPY tax-service ./tax-service
COPY performance-service ./performance-service
COPY project-service ./project-service
COPY timesheet-service ./timesheet-service
COPY exit-service ./exit-service
COPY document-service ./document-service
COPY notification-service ./notification-service
COPY reporting-service ./reporting-service
COPY api-gateway ./api-gateway
RUN npm ci && npx tsc -b && npm prune --omit=dev

FROM node:20-alpine
ARG SERVICE
ENV NODE_ENV=production SERVICE=${SERVICE}
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/common-library ./common-library
COPY --from=build /app/${SERVICE} ./${SERVICE}
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
CMD ["sh", "-c", "node ${SERVICE}/dist/main.js"]
