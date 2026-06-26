import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  curatedImageExtensions,
  curatedImageFilePath,
  curatedImagePublicUrl,
  curatedImageSources,
  findLocalCuratedImageUrl,
  type CuratedImageCategory,
  type CuratedImageExtension,
  type CuratedImageSource,
} from "./curated-image-data";

const workspaceRoot = process.cwd();
const force = process.argv.includes("--force");
const groupArg = process.argv
  .find((argument) => argument.startsWith("--group="))
  ?.split("=")
  .at(1);
const requestHeaders = {
  "User-Agent":
    "25-words-or-less-content-importer/1.0 (local asset caching; contact: local-dev)",
};

const groupFilters: Record<string, (category: CuratedImageCategory) => boolean> = {
  all: () => true,
  games: (category) => category === "game",
  "gym-leaders": (category) => category === "gym_leader",
  people: (category) => category === "gym_leader" || category === "professor",
  professors: (category) => category === "professor",
  types: (category) => category === "type",
};

function shouldDownloadSource(source: CuratedImageSource) {
  if (!groupArg) {
    return true;
  }

  const groupFilter = groupFilters[groupArg];
  if (!groupFilter) {
    throw new Error(
      `Unknown --group=${groupArg}. Expected one of: ${Object.keys(groupFilters).join(", ")}.`,
    );
  }

  return groupFilter(source.category);
}

type PageImageResponse = {
  query?: {
    pages?: Record<
      string,
      { thumbnail?: { source?: string; width?: number; height?: number } }
    >;
  };
};

type ArchiveImageResponse = {
  query?: {
    pages?: Record<
      string,
      {
        missing?: true;
        imageinfo?: Array<{
          url?: string;
          thumburl?: string;
          mime?: string;
          size?: number;
        }>;
      }
    >;
  };
};

async function pageImageUrlFor(
  source: Extract<CuratedImageSource, { provider: "fandom-page-image" }>,
) {
  const params = new URLSearchParams({
    action: "query",
    titles: source.title,
    prop: "pageimages",
    format: "json",
    pithumbsize: "500",
    redirects: "1",
  });
  const response = await fetch(`https://pokemon.fandom.com/api.php?${params}`, {
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error(`Fandom page image lookup returned ${response.status}`);
  }

  const data = (await response.json()) as PageImageResponse;
  return Object.values(data.query?.pages ?? {}).find(
    (page) => page.thumbnail?.source,
  )?.thumbnail?.source;
}

async function archiveImageUrlFor(
  source: Extract<
    CuratedImageSource,
    { provider: "bulbagarden-archives-file" }
  >,
) {
  const params = new URLSearchParams({
    action: "query",
    titles: `File:${source.fileName}`,
    prop: "imageinfo",
    iiprop: "url|mime|size",
    format: "json",
  });

  if (source.category === "game") {
    params.set("iiurlwidth", "256");
    params.set("iiprop", "url|mime|size|thumburl");
  }

  const response = await fetch(
    `https://archives.bulbagarden.net/w/api.php?${params}`,
    {
      headers: requestHeaders,
    },
  );

  if (!response.ok) {
    throw new Error(`Archive image lookup returned ${response.status}`);
  }

  const data = (await response.json()) as ArchiveImageResponse;
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing) {
    throw new Error(`Archive file not found: ${source.fileName}`);
  }

  const imageInfo = page.imageinfo?.[0];
  return imageInfo?.thumburl ?? imageInfo?.url;
}

async function imageUrlFor(source: CuratedImageSource) {
  if (source.provider === "bulbagarden-archives-file") {
    return await archiveImageUrlFor(source);
  }

  return await pageImageUrlFor(source);
}

function extensionFor(contentType: string | null, imageUrl: string) {
  if (contentType?.includes("image/webp")) {
    return "webp";
  }

  if (contentType?.includes("image/png")) {
    return "png";
  }

  if (contentType?.includes("image/jpeg")) {
    return "jpg";
  }

  const urlExtension = new URL(imageUrl).pathname
    .split(".")
    .at(-1)
    ?.toLowerCase();

  if (
    urlExtension &&
    curatedImageExtensions.includes(urlExtension as CuratedImageExtension)
  ) {
    return urlExtension as CuratedImageExtension;
  }

  return "webp";
}

async function removeExistingVariants(source: CuratedImageSource) {
  await Promise.all(
    curatedImageExtensions.map((extension) =>
      rm(curatedImageFilePath(workspaceRoot, source, extension), {
        force: true,
      }),
    ),
  );
}

async function downloadImage(source: CuratedImageSource, imageUrl: string) {
  const response = await fetch(imageUrl, { headers: requestHeaders });
  if (!response.ok) {
    throw new Error(`Image download returned ${response.status}`);
  }

  const extension = extensionFor(response.headers.get("content-type"), imageUrl);
  const filePath = curatedImageFilePath(workspaceRoot, source, extension);
  await mkdir(dirname(filePath), { recursive: true });

  if (force) {
    await removeExistingVariants(source);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);

  return curatedImagePublicUrl(source, extension);
}

async function main() {
  const sources = Object.values(curatedImageSources).filter(shouldDownloadSource);
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const source of sources) {
    const existingUrl = findLocalCuratedImageUrl(workspaceRoot, source);
    if (existingUrl && !force) {
      skippedCount += 1;
      console.log(`skip ${source.sourceId}: ${existingUrl}`);
      continue;
    }

    try {
      const imageUrl = await imageUrlFor(source);
      if (!imageUrl) {
        failedCount += 1;
        console.warn(`missing ${source.sourceId}: no image URL resolved`);
        continue;
      }

      const localUrl = await downloadImage(source, imageUrl);
      downloadedCount += 1;
      console.log(`downloaded ${source.sourceId}: ${localUrl}`);
    } catch (error) {
      failedCount += 1;
      console.warn(
        `failed ${source.sourceId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(
    `Curated image download complete. Downloaded ${downloadedCount}, skipped ${skippedCount}, failed ${failedCount}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
