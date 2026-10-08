import assert from "node:assert/strict";
import test from "node:test";
import { AdminSystemDataSnapshotService } from "./admin-system-data-snapshot.service";

const AdmZip = require("adm-zip") as new (buffer?: Buffer) => {
  readAsText(name: string): string;
  getEntries(): Array<{ entryName: string }>;
};

test("keeps an unreadable online image URL in an exportable snapshot", async () => {
  const previousEnvironment = process.env.SYSTEM_DATA_ENVIRONMENT;
  const previousBase = process.env.ASSET_PUBLIC_BASE_URL;
  process.env.SYSTEM_DATA_ENVIRONMENT = "ONLINE";
  process.env.ASSET_PUBLIC_BASE_URL = "https://static.trtst.com/O";

  const imageUrl = "https://static.trtst.com/O/uploads/admin-recipe-images/cover.jpg";
  const tx = new Proxy({}, {
    get: (_target, name) => ({
      findMany: async () => name === "siteContent"
        ? [{ id: 1, coverImageUrl: imageUrl }]
        : []
    })
  });
  const prisma = {
    $transaction: async (callback: (value: object) => Promise<unknown>) => callback(tx)
  };
  const assetStorage = {
    readBuffer: async () => { throw new Error("图片不存在"); }
  };

  try {
    const service = new AdminSystemDataSnapshotService(prisma as never, assetStorage as never);
    const archive = await service.exportPackage(["articles"]);
    const zip = new AdmZip(archive);
    const manifest = JSON.parse(zip.readAsText("manifest.json"));
    const data = JSON.parse(zip.readAsText("data.json"));

    assert.deepEqual(zip.getEntries().map(entry => entry.entryName).sort(), ["data.json", "manifest.json"]);
    assert.deepEqual(manifest.assets, []);
    assert.equal(data.articles.SiteContent[0].coverImageUrl, imageUrl);
  } finally {
    if (previousEnvironment === undefined) delete process.env.SYSTEM_DATA_ENVIRONMENT;
    else process.env.SYSTEM_DATA_ENVIRONMENT = previousEnvironment;
    if (previousBase === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    else process.env.ASSET_PUBLIC_BASE_URL = previousBase;
  }
});
