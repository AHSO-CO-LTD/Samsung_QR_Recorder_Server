import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guidesRoot = path.join(root, "frontend", "public", "guides");
const manifestPath = path.join(guidesRoot, "manifest.json");
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function readJson(filePath, required = true) {
  if (!fs.existsSync(filePath)) {
    if (required) {
      throw new Error(`Required guide metadata is missing: ${path.relative(root, filePath)}`);
    }
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.relative(root, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readLeadingOrder(value, label) {
  const match = /^(\d+)(?:[-_].*)?$/.exec(value);
  if (!match) {
    throw new Error(`${label} must start with a number: ${value}`);
  }
  return Number(match[1]);
}

function compareOrderedEntries(first, second) {
  return first.order - second.order || first.name.localeCompare(second.name, "en", { numeric: true, sensitivity: "base" });
}

function findDuplicateOrder(entries) {
  return entries.find((entry, index) => index > 0 && entries[index - 1].order === entry.order);
}

function assertContiguousOrders(entries, label) {
  entries.forEach((entry, index) => {
    const expectedOrder = index + 1;
    if (entry.order !== expectedOrder) {
      throw new Error(`${label} must be numbered continuously from 01. Expected ${expectedOrder}, received ${entry.order}.`);
    }
  });
}

function readGuide(folderEntry) {
  const folderPath = path.join(guidesRoot, folderEntry.name);
  const order = readLeadingOrder(folderEntry.name, "Guide folder");
  const metadata = readJson(path.join(folderPath, "guide.json"));
  if (typeof metadata.title !== "string" || !metadata.title.trim()) {
    throw new Error(`Guide title is required: ${path.relative(root, path.join(folderPath, "guide.json"))}`);
  }

  const folderEntries = fs.readdirSync(folderPath, { withFileTypes: true });
  const stepEntries = folderEntries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json" && /^\d+$/.test(path.basename(entry.name, ".json")))
    .map((entry) => {
      const baseName = path.basename(entry.name, ".json");
      const stepMetadata = readJson(path.join(folderPath, entry.name));
      if (typeof stepMetadata.title !== "string" || !stepMetadata.title.trim()) {
        throw new Error(`Step title is required: ${path.relative(root, path.join(folderPath, entry.name))}`);
      }
      if (typeof stepMetadata.content !== "string" || !stepMetadata.content.trim()) {
        throw new Error(`Step content is required: ${path.relative(root, path.join(folderPath, entry.name))}`);
      }
      return {
        name: entry.name,
        baseName,
        order: readLeadingOrder(baseName, `Guide step in ${folderEntry.name}`),
        title: stepMetadata.title.trim(),
        content: stepMetadata.content.trim()
      };
    })
    .sort(compareOrderedEntries);

  const duplicateStepOrder = findDuplicateOrder(stepEntries);
  if (duplicateStepOrder) {
    throw new Error(`Duplicate step order ${duplicateStepOrder.order} in guide folder ${folderEntry.name}`);
  }
  assertContiguousOrders(stepEntries, `Guide steps in ${folderEntry.name}`);
  const stepMetadataByBaseName = new Map(stepEntries.map((entry) => [entry.baseName, entry]));

  const imageEntries = folderEntries
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const extension = path.extname(entry.name);
      const baseName = path.basename(entry.name, extension);
      return {
        name: entry.name,
        baseName,
        order: readLeadingOrder(baseName, `Guide image in ${folderEntry.name}`)
      };
    })
    .sort(compareOrderedEntries);

  const duplicateOrder = findDuplicateOrder(imageEntries);
  if (duplicateOrder) {
    throw new Error(`Duplicate image order ${duplicateOrder.order} in guide folder ${folderEntry.name}`);
  }

  imageEntries.forEach((entry) => {
    if (!stepMetadataByBaseName.has(entry.baseName)) {
      throw new Error(`Step metadata is missing for image: ${path.relative(root, path.join(folderPath, entry.name))}`);
    }
  });
  const imageByBaseName = new Map(imageEntries.map((entry) => [entry.baseName, entry]));

  return {
    id: folderEntry.name,
    order,
    title: metadata.title.trim(),
    description: typeof metadata.description === "string" ? metadata.description.trim() : "",
    slides: stepEntries.map((stepMetadata) => {
      const imageEntry = imageByBaseName.get(stepMetadata.baseName);
      return {
        order: stepMetadata.order,
        image: imageEntry?.name ?? null,
        src: imageEntry ? `/guides/${encodeURIComponent(folderEntry.name)}/${encodeURIComponent(imageEntry.name)}` : null,
        title: stepMetadata.title,
        content: stepMetadata.content
      };
    })
  };
}

fs.mkdirSync(guidesRoot, { recursive: true });

const guideFolders = fs
  .readdirSync(guidesRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      /^\d+[-_]/.test(entry.name) &&
      fs.existsSync(path.join(guidesRoot, entry.name, "guide.json")) &&
      readJson(path.join(guidesRoot, entry.name, "guide.json")).hidden !== true
  )
  .map((entry) => ({
    entry,
    name: entry.name,
    order: readLeadingOrder(entry.name, "Guide folder")
  }))
  .sort(compareOrderedEntries);

const duplicateGuideOrder = guideFolders.find((folder, index) => index > 0 && guideFolders[index - 1].order === folder.order);
if (duplicateGuideOrder) {
  throw new Error(`Duplicate guide order: ${duplicateGuideOrder.order}`);
}

const manifest = {
  version: 1,
  guides: guideFolders.map((folder) => readGuide(folder.entry))
};
const nextContent = `${JSON.stringify(manifest, null, 2)}\n`;
const currentContent = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : "";

if (currentContent !== nextContent) {
  fs.writeFileSync(manifestPath, nextContent, "utf8");
}

console.log(`[guides] Generated ${manifest.guides.length} guides in ${path.relative(root, manifestPath)}`);
