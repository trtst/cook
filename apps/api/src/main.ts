import "reflect-metadata";
import { loadLocalEnv } from "./common/load-env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { AppModule } from "./modules/app.module";

loadLocalEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: ["http://127.0.0.1:5174", "http://localhost:5174"],
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-admin-version",
      "x-admin-build",
      "x-cook-from",
      "x-cook-version",
      "x-app-version",
      "x-app-build",
      "x-platform",
      "x-request-id"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Next Meal API")
    .setDescription("Auth/User/DiningGroup v0.1 contract")
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "UserBearerAuth")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "AdminBearerAuth")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
