import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const svgPath = join(iconsDir, "icon.svg");

const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(join(publicDir, `pwa-${size}x${size}.png`), png);
  console.log(`Created pwa-${size}x${size}.png`);
}
