# syntax=docker/dockerfile:1
# course service.  BUILD CONTEXT = project root:  docker compose build course-service
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# 1) third-party dependencies first (this layer is shared by all services and cached)
COPY requirements.lock /tmp/requirements.lock
RUN pip install -r /tmp/requirements.lock

# 2) shared library, then this service's code
COPY libs/sms_common /tmp/sms_common
RUN pip install /tmp/sms_common && rm -rf /tmp/sms_common
COPY services/course/ /app/
COPY docker/entrypoint.sh /entrypoint.sh

# 3) run as an unprivileged user (uid 1000 so bind-mounted ./var/compose dirs stay writable)
RUN useradd --uid 1000 --create-home sms && mkdir -p /data && chown -R sms /data /app
USER sms
ENV PORT=8003
EXPOSE 8003
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/health' % os.environ['PORT'], timeout=2)"
ENTRYPOINT ["/entrypoint.sh"]
