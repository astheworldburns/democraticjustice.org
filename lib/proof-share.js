import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import satori from "satori";
import { html } from "satori-html";

import { truncateProofText } from "./proof.js";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_ASPECT_RATIO = CARD_WIDTH / CARD_HEIGHT;

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

function decodeLocalImageSource(src = "") {
  const source = src.toString().trim();

  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function resolveLocalImagePath(src = "", projectRoot) {
  const source = decodeLocalImageSource(src);

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
        <linearGradient id="leftShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#090b0f" stop-opacity="0.92"/>
          <stop offset="0.5" stop-color="#090b0f" stop-opacity="0.68"/>
          <stop offset="1" stop-color="#090b0f" stop-opacity="0.08"/>
        </linearGradient>
        <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#090b0f" stop-opacity="0"/>
          <stop offset="1" stop-color="#090b0f" stop-opacity="0.46"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#leftShade)"/>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bottomShade)"/>
    </svg>
  `);

  return sharp(imagePath)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "attention" })
    .composite([{ input: gradient, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

function getHeadlineSize(text = "") {
  if (text.length > 82) {
    return 54;
  }

  if (text.length > 64) {
    return 60;
  }

  if (text.length > 46) {
    return 68;
  }

  return 78;
}

function getDeckSize(text = "") {
  if (text.length > 150) {
    return 26;
  }

  if (text.length > 112) {
    return 29;
  }

  return 32;
}

function normalizeShareCard(card = {}, options = {}) {
  const proofCard = card.proofCard || card;
  const proofMeta = proofCard?.axiomCount
    ? `${proofCard.axiomCount} axioms · ${proofCard.theoremCount || proofCard.logicCount} theorems · ${proofCard.sourceDocumentCount} documents`
    : "";

  return {
    slug: card.slug || proofCard.slug,
    siteTitle: options.siteTitle || card.siteTitle || proofCard.siteTitle || "Democratic Justice",
    eyebrow: card.eyebrow || card.kicker || (proofMeta ? "Proof" : "Investigation"),
    headline: card.headline || card.title || proofCard.articleTitle,
    deck: card.deck || card.description || proofCard.articleDescription || proofCard.qed || proofCard.conclusion,
    featuredImage: card.featuredImage || card.featured_image || proofCard.featuredImage,
    proofMeta
  };
}

export async function renderArticleShareImage(card, outputDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const shareCard = normalizeShareCard(card, options);
  const siteTitle = escapeHtml(shareCard.siteTitle);
  const eyebrow = escapeHtml(shareCard.eyebrow);
  const headlineSource = truncateProofText(shareCard.headline, 94);
  const deckSource = truncateProofText(shareCard.deck, 176);
  const headline = escapeHtml(headlineSource);
  const deck = escapeHtml(deckSource);
  const headlineFontSize = getHeadlineSize(headlineSource);
  const deckFontSize = getDeckSize(deckSource);
  const backgroundImage = await renderBackgroundImage(shareCard.featuredImage, projectRoot);
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(26, 20, "#17191d");
  const proofMeta = escapeHtml(shareCard.proofMeta);

  const markup = html(`
    <div
      style="
        display:flex;
        position:relative;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        overflow:hidden;
        background:transparent;
        color:#fffaf0;
      "
    >
      <div
        style="
          display:flex;
          position:absolute;
          inset:26px;
          border:2px solid rgba(255, 250, 240, 0.72);
          border-radius:34px;
          box-shadow:inset 0 0 0 1px rgba(23, 25, 29, 0.28);
        "
      ></div>
      <div
        style="
          display:flex;
          position:absolute;
          top:48px;
          left:54px;
          align-items:center;
          gap:12px;
          padding:13px 17px;
          border-radius:999px;
          background:rgba(255, 250, 240, 0.92);
          color:#17191d;
          box-shadow:0 18px 44px rgba(0, 0, 0, 0.28);
        "
      >
        ${headerMark}
        <span
          style="
            display:flex;
            font-family:Space Grotesk;
            font-size:16px;
            font-weight:700;
            letter-spacing:2.2px;
            text-transform:uppercase;
          "
        >
          ${siteTitle}
        </span>
      </div>
      <div
        style="
          display:flex;
          position:absolute;
          left:54px;
          right:54px;
          bottom:44px;
          flex-direction:column;
          gap:17px;
          max-width:760px;
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            gap:14px;
            color:#f7f2e8;
            font-family:Space Grotesk;
            font-size:15px;
            font-weight:700;
            letter-spacing:2.4px;
            text-transform:uppercase;
          "
        >
          <span>${eyebrow}</span>
          ${proofMeta ? `<span style="color:rgba(247, 242, 232, 0.72);">${proofMeta}</span>` : ""}
        </div>
        <h1
          style="
            display:flex;
            margin:0;
            color:#fffaf0;
            font-family:Source Serif 4;
            font-size:${headlineFontSize}px;
            font-weight:700;
            line-height:0.92;
            letter-spacing:-2.4px;
            text-wrap:balance;
          "
        >
          ${headline}
        </h1>
        <p
          style="
            display:flex;
            margin:0;
            color:rgba(255, 250, 240, 0.92);
            font-family:Space Grotesk;
            font-size:${deckFontSize}px;
            font-weight:700;
            line-height:1.08;
            letter-spacing:-0.8px;
          "
        >
          ${deck}
        </p>
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
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${shareCard.slug}.jpg`);
  await writeFile(outputPath, png);

  return outputPath;
}

export async function renderProofShareImage(proofCard, outputDir, options = {}) {
  return renderArticleShareImage(proofCard, outputDir, options);
}

export const socialCardDimensions = {
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  aspectRatio: CARD_ASPECT_RATIO
};
