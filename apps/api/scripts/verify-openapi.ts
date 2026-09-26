import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { API_DOC_TITLE } from "../src/config/app";
import { AppModule } from "../src/modules/app.module";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateDataSchema(path: string, method: string, data: Record<string, any>, schemas: Record<string, unknown>) {
  if (data.type === "object" && data.nullable === true && data.example === null && Object.keys(data.properties ?? {}).length === 0) {
    return;
  }

  if (data.$ref) {
    const name = String(data.$ref).split("/").at(-1);
    assert(name && schemas[name], `${method.toUpperCase()} ${path} references missing schema ${String(data.$ref)}`);
    return;
  }

  if (data.type === "array") {
    assert(data.items?.$ref, `${method.toUpperCase()} ${path} array data must reference an item model`);
    const name = String(data.items.$ref).split("/").at(-1);
    assert(name && schemas[name], `${method.toUpperCase()} ${path} references missing array item schema`);
    return;
  }

  assert(data.type === "object", `${method.toUpperCase()} ${path} data must be a concrete object, array, or model reference`);
  assert(Object.keys(data.properties ?? {}).length > 0, `${method.toUpperCase()} ${path} data object has no properties`);
}

function isExplicitBinaryImageResponse(response: Record<string, any>) {
  const content = Object.entries(response.content ?? {});
  return content.length > 0 && content.every(([contentType, media]) =>
    contentType.startsWith("image/") &&
    (media as Record<string, any>).schema?.type === "string" &&
    (media as Record<string, any>).schema?.format === "binary"
  );
}

export function validateOpenApiDocument(document: { paths?: Record<string, any>; components?: { schemas?: Record<string, unknown> } }) {
  const schemas = document.components?.schemas ?? {};
  let operationCount = 0;

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      operationCount += 1;
      const response = operation.responses?.["200"] as Record<string, any> | undefined;
      assert(response && "$ref" in response === false, `${method.toUpperCase()} ${path} has no inline 200 response`);
      if (isExplicitBinaryImageResponse(response)) continue;
      const content = response.content as Record<string, any> | undefined;
      assert(
        !Object.keys(content ?? {}).some(contentType => contentType.startsWith("image/")),
        `${method.toUpperCase()} ${path} binary response must declare an image content type and binary schema`
      );
      const schema = content?.["application/json"]?.schema as Record<string, any> | undefined;
      assert(schema?.type === "object", `${method.toUpperCase()} ${path} has no response envelope schema`);
      assert(schema.required?.includes("data"), `${method.toUpperCase()} ${path} envelope does not require data`);
      const dataSchema = schema.properties?.data as Record<string, any> | undefined;
      const requiredModel = method === "get" && path.endsWith("/fridge-traces/summary")
        ? "FridgeTraceSummaryResponseModel"
        : method === "post" && path.endsWith("/meal-plans/{planItemId}/cooking-complete")
          ? "CookingTraceResponseModel"
          : null;
      if (requiredModel) {
        assert(
          dataSchema?.$ref === `#/components/schemas/${requiredModel}`,
          `${method.toUpperCase()} ${path} must reference ${requiredModel}`
        );
      }
      validateDataSchema(path, method, dataSchema, schemas);
    }
  }

  assert(operationCount > 0, "OpenAPI document contains no operations");
  return { operationCount, responseSchemaCount: Object.keys(schemas).length };
}

export async function main() {
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true, transform: true }));
    await app.init();

    const config = new DocumentBuilder().setTitle(API_DOC_TITLE).setVersion("0.1.0").build();
    const document = SwaggerModule.createDocument(app, config);
    console.log(JSON.stringify(validateOpenApiDocument(document), null, 2));
  } finally {
    await app?.close();
  }
}

if (require.main === module) {
  void main();
}
