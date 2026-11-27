#!/usr/bin/env bash
# GET /health/live on localhost:8080 and succeed only on HTTP 200 (the aspnet base image has no curl/wget).
exec 3<>/dev/tcp/127.0.0.1/8080 || exit 1
printf 'GET /health/live HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3
head -n1 <&3 | grep -q ' 200 ' || exit 1
