# Estágio 1: compila com Maven (não é preciso ter o Maven instalado na máquina)
FROM maven:3.9-eclipse-temurin-11 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package

# Estágio 2: imagem final leve, somente com o JRE e o JAR (mesmo padrão das aulas)
FROM eclipse-temurin:11-jre
WORKDIR /app
COPY --from=build /build/target/producer-service-jar-with-dependencies.jar producer-service.jar
CMD ["java", "-jar", "producer-service.jar"]
