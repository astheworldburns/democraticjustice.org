import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import satori from "satori";
import { html } from "satori-html";

import { truncateProofText } from "./proof.js";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1200;

let fontCachePromise;

function escapeHtml(value = "") {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadFonts(projectRoot) {
  if (!fontCachePromise) {
    const groteskMediumPath = path.join(
      projectRoot,
      "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff"
    );
    const groteskBoldPath = path.join(
      projectRoot,
      "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff"
    );
    const serifRegularPath = path.join(
      projectRoot,
      "node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff"
    );
    const serifBoldPath = path.join(
      projectRoot,
      "node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff"
    );

    fontCachePromise = Promise.all([
      readFile(groteskMediumPath),
      readFile(groteskBoldPath),
      readFile(serifRegularPath),
      readFile(serifBoldPath)
    ]).then(([groteskMedium, groteskBold, serifRegular, serifBold]) => [
      {
        name: "Space Grotesk",
        data: groteskMedium,
        weight: 500,
        style: "normal"
      },
      {
        name: "Space Grotesk",
        data: groteskBold,
        weight: 700,
        style: "normal"
      },
      {
        name: "Source Serif 4",
        data: serifRegular,
        weight: 400,
        style: "normal"
      },
      {
        name: "Source Serif 4",
        data: serifBold,
        weight: 700,
        style: "normal"
      }
    ]);
  }

  return fontCachePromise;
}

function proofMarkMarkup(width, height, color = "#1a1612") {
  const stroke = Math.max(2, Math.round(height * 0.16));
  const bracketWidth = Math.max(4, Math.round(width * 0.18));
  const dotSize = Math.max(3, Math.round(height * 0.22));
  const innerLeft = bracketWidth + Math.round(width * 0.12);
  const innerRight = width - bracketWidth - Math.round(width * 0.12) - dotSize;
  const topDotLeft = Math.round((width - dotSize) / 2);
  const topDotTop = Math.round(height * 0.18);
  const bottomDotTop = height - dotSize - Math.round(height * 0.16);

  return `
    <span style="display:flex; position:relative; width:${width}px; height:${height}px;">
      <span
        style="
          position:absolute;
          left:0;
          top:0;
          width:${bracketWidth}px;
          height:${height}px;
          border-left:${stroke}px solid ${color};
          border-top:${stroke}px solid ${color};
          border-bottom:${stroke}px solid ${color};
        "
      ></span>
      <span
        style="
          position:absolute;
          right:0;
          top:0;
          width:${bracketWidth}px;
          height:${height}px;
          border-right:${stroke}px solid ${color};
          border-top:${stroke}px solid ${color};
          border-bottom:${stroke}px solid ${color};
        "
      ></span>
      <span
        style="
          position:absolute;
          left:${topDotLeft}px;
          top:${topDotTop}px;
          width:${dotSize}px;
          height:${dotSize}px;
          border-radius:999px;
          background:${color};
        "
      ></span>
      <span
        style="
          position:absolute;
          left:${innerLeft}px;
          top:${bottomDotTop}px;
          width:${dotSize}px;
          height:${dotSize}px;
          border-radius:999px;
          background:${color};
        "
      ></span>
      <span
        style="
          position:absolute;
          left:${innerRight}px;
          top:${bottomDotTop}px;
          width:${dotSize}px;
          height:${dotSize}px;
          border-radius:999px;
          background:${color};
        "
      ></span>
    </span>
  `;
}

function resolveLocalImagePath(src = "", projectRoot) {
  const source = src.toString().trim();

  if (!source || /^https?:\/\//i.test(source) || source.startsWith("data:")) {
    return "";
  }

  if (source.startsWith("/assets/")) {
    return path.join(projectRoot, "src", source);
  }

  if (source.startsWith("/")) {
    return path.join(projectRoot, source.slice(1));
  }

  return path.resolve(projectRoot, source);
}

async function renderBackgroundImage(src = "", projectRoot) {
  const source = src.toString().trim();

  if (!source || /^https?:\/\//i.test(source) || source.startsWith("data:")) {
    return sharp({
      create: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        channels: 4,
        background: "#17191d"
      }
    })
      .png()
      .toBuffer();
  }

  const imagePath = resolveLocalImagePath(source, projectRoot);
  const gradient = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0a0c0f" stop-opacity="0.08"/>
          <stop offset="0.43" stop-color="#0a0c0f" stop-opacity="0.2"/>
          <stop offset="1" stop-color="#0a0c0f" stop-opacity="0.78"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#shade)"/>
    </svg>
  `);

  return sharp(imagePath)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "attention" })
    .composite([{ input: gradient, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

export async function renderProofShareImage(proofCard, outputDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const siteTitle = escapeHtml(options.siteTitle || proofCard.siteTitle || "Democratic Justice");
  const headlineSource = truncateProofText(proofCard.articleTitle, 96);
  const deckSource = truncateProofText(proofCard.articleDescription || proofCard.qed || proofCard.conclusion, 178);
  const headline = escapeHtml(headlineSource);
  const deck = escapeHtml(deckSource);
  const footerFacts = `${proofCard.axiomCount} axioms · ${proofCard.theoremCount || proofCard.logicCount} theorems · ${proofCard.sourceDocumentCount} documents`;
  const headlineFontSize = headlineSource.length > 76 ? 70 : headlineSource.length > 54 ? 78 : 88;
  const deckFontSize = deckSource.length > 142 ? 30 : deckSource.length > 104 ? 34 : 38;
  const backgroundImage = await renderBackgroundImage(proofCard.featuredImage, projectRoot);
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(24, 18, "#17191d");

  const markup = html(`
    <div
      style="
        display:flex;
        position:relative;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        overflow:hidden;
        background:transparent;
        color:#f7f2e8;
      "
    >
      <div
        style="
          display:flex;
          position:absolute;
          inset:34px;
          border:2px solid rgba(247, 242, 232, 0.72);
          border-radius:40px;
          box-shadow:inset 0 0 0 1px rgba(23, 25, 29, 0.3);
        "
      ></div>
      <div
        style="
          display:flex;
          position:absolute;
          top:64px;
          left:64px;
          align-items:center;
          gap:12px;
          padding:16px 20px;
          border-radius:999px;
          background:rgba(247, 242, 232, 0.9);
          color:#17191d;
          box-shadow:0 18px 44px rgba(0, 0, 0, 0.24);
        "
      >
        ${headerMark}
        <span
          style="
            display:flex;
            font-family:Space Grotesk;
            font-size:17px;
            font-weight:700;
            letter-spacing:2.4px;
            text-transform:uppercase;
          "
        >
          Proof
        </span>
      </div>
      <div
        style="
          display:flex;
          position:absolute;
          left:64px;
          right:64px;
          bottom:64px;
          flex-direction:column;
          gap:22px;
          padding:34px 38px 32px;
          border:1px solid rgba(247, 242, 232, 0.32);
          border-radius:34px;
          background:rgba(18, 20, 24, 0.76);
          box-shadow:0 24px 70px rgba(0, 0, 0, 0.42);
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:24px;
            color:#f7f2e8;
            font-family:Space Grotesk;
            font-size:15px;
            font-weight:700;
            letter-spacing:2.4px;
            text-transform:uppercase;
          "
        >
          <span>${siteTitle}</span>
          <span style="color:rgba(247, 242, 232, 0.76);">${escapeHtml(footerFacts)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:16px;">
          <h1
            style="
              display:flex;
              margin:0;
              max-width:980px;
              color:#fffaf0;
              font-family:Source Serif 4;
              font-size:${headlineFontSize}px;
              font-weight:700;
              line-height:0.9;
              letter-spacing:-3px;
            "
          >
            ${headline}
          </h1>
          <p
            style="
              display:flex;
              margin:0;
              max-width:980px;
              color:rgba(247, 242, 232, 0.92);
              font-family:Space Grotesk;
              font-size:${deckFontSize}px;
              font-weight:700;
              line-height:1.08;
              letter-spacing:-1px;
            "
          >
            ${deck}
          </p>
        </div>
      </div>
    </div>
  `);

  const svg = await satori(markup, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts
  });
  const overlay = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: CARD_WIDTH
    }
  }).render().asPng();
  const png = await sharp(backgroundImage)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${proofCard.slug}.png`);
  await writeFile(outputPath, png);

  return outputPath;
}
