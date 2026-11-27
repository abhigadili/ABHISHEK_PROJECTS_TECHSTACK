# Build the jars first: mvn clean package   (see docs/202611251532-docker-setup.md)
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/hr-leave-service.jar app.jar
EXPOSE 9104
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"
HEALTHCHECK --interval=15s --timeout=3s --start-period=90s --retries=6 CMD bash -c ':> /dev/tcp/127.0.0.1/9104' || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
