import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/modules/app.module";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateDataSchema(path: string, method: string, data: Record<string, any>, schemas: Record<string, unknown>) {
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

async function main() {
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true, transform: true }));
    await app.init();

    const config = new DocumentBuilder().setTitle("Next Meal API").setVersion("0.1.0").build();
    const document = SwaggerModule.createDocument(app, config);
    const schemas = document.components?.schemas ?? {};
    let operationCount = 0;

    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const method of ["get", "post", "put", "patch", "delete"] as const) {
        const operation = pathItem?.[method];
        if (!operation) continue;
        operationCount += 1;
        const response = operation.responses?.["200"];
        assert(response && "$ref" in response === false, `${method.toUpperCase()} ${path} has no inline 200 response`);
        const content = response.content?.["application/json"];
        const schema = content?.schema as Record<string, any> | undefined;
        assert(schema?.type === "object", `${method.toUpperCase()} ${path} has no response envelope schema`);
        assert(schema.required?.includes("data"), `${method.toUpperCase()} ${path} envelope does not require data`);
        validateDataSchema(path, method, schema.properties?.data, schemas);
      }
    }

    assert(operationCount > 0, "OpenAPI document contains no operations");
    console.log(JSON.stringify({ operationCount, responseSchemaCount: Object.keys(schemas).length }, null, 2));
  } finally {
    await app?.close();
  }
}

void main();
