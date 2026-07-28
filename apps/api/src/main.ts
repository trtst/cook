import "reflect-metadata";
import { loadLocalEnv } from "./common/load-env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { API_DOC_TITLE } from "./config/app";
import { AppModule } from "./modules/app.module";

loadLocalEnv();

function readOrigins(rawValue: string | undefined) {
  const defaults = ["http://127.0.0.1:5174", "http://localhost:5174"];
  const source = rawValue?.trim() ? rawValue : defaults.join(",");

  return [...new Set(source.split(",").map(item => item.trim()).filter(Boolean))];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: readOrigins(process.env.CORS_ORIGINS),
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
      forbidNonWhitelisted: true,
      whitelist: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(API_DOC_TITLE)
    .setDescription("Auth、User 与唯一当前 DiningGroup 契约")
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
