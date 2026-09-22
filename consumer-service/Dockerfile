# Estágio 1: compila com Maven
FROM maven:3.9-eclipse-temurin-11 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package

# imagem final
FROM eclipse-temurin:11-jre
WORKDIR /app
COPY --from=build /build/target/consumer-service-jar-with-dependencies.jar consumer-service.jar
CMD ["java", "-jar", "consumer-service.jar"]
