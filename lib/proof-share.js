import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { html } from "satori-html";

import { truncateProofText } from "./proof.js";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

let fontCachePromise;

function escapeHtml(value = "") {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadFonts(projectRoot) {
  if (!fontCachePromise) {
    const interMediumPath = path.join(
      projectRoot,
      "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff"
    );
    const interBoldPath = path.join(
      projectRoot,
      "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"
    );
    const loraRegularPath = path.join(
      projectRoot,
      "node_modules/@fontsource/lora/files/lora-latin-400-normal.woff"
    );
    const loraBoldPath = path.join(
      projectRoot,
      "node_modules/@fontsource/lora/files/lora-latin-700-normal.woff"
    );

    fontCachePromise = Promise.all([
      readFile(interMediumPath),
      readFile(interBoldPath),
      readFile(loraRegularPath),
      readFile(loraBoldPath)
    ]).then(([interMedium, interBold, loraRegular, loraBold]) => [
      {
        name: "Inter",
        data: interMedium,
        weight: 500,
        style: "normal"
      },
      {
        name: "Inter",
        data: interBold,
        weight: 700,
        style: "normal"
      },
      {
        name: "Lora",
        data: loraRegular,
        weight: 400,
        style: "normal"
      },
      {
        name: "Lora",
        data: loraBold,
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

export async function renderProofShareImage(proofCard, outputDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const siteTitle = escapeHtml(options.siteTitle || proofCard.siteTitle || "Democratic Justice");
  const issue = escapeHtml(truncateProofText(proofCard.issue, 150));
  const conclusionSource = truncateProofText(proofCard.conclusion, 165);
  const conclusion = escapeHtml(conclusionSource);
  const proofUrl = escapeHtml(proofCard.proofUrl);
  const footerFacts = `${proofCard.axiomCount} axioms · ${proofCard.logicCount} logic steps · shareable proof`;
  const conclusionFontSize = conclusionSource.length > 145 ? 34 : conclusionSource.length > 110 ? 39 : 46;
  const conclusionLineHeight = conclusionSource.length > 145 ? 1.06 : 1.08;
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(20, 14);
  const conclusionMark = proofMarkMarkup(22, 16);

  const markup = html(`
    <div
      style="
        display:flex;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        padding:44px;
        background:
          radial-gradient(circle at top left, rgba(219, 227, 238, 0.72), transparent 42%),
          linear-gradient(180deg, #fffdf9 0%, #f4efe7 100%);
        color:#1a1612;
      "
    >
      <div
        style="
          display:flex;
          flex:1;
          flex-direction:column;
          border:2px solid rgba(49, 43, 37, 0.9);
          background:rgba(255, 255, 252, 0.94);
          box-shadow:0 20px 48px rgba(12, 10, 8, 0.12);
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:18px 24px;
            border-bottom:1px solid rgba(197, 190, 180, 0.95);
            font-family:Inter;
            font-size:18px;
            font-weight:700;
            letter-spacing:2.6px;
            text-transform:uppercase;
          "
        >
          <div style="display:flex; align-items:center; gap:12px;">
            ${headerMark}
            <span>${siteTitle}</span>
          </div>
          <span style="color:#23354e;">Proof Card</span>
        </div>

        <div style="display:flex; flex:1; flex-direction:column; padding:28px 30px 24px;">
          <div
            style="
              display:flex;
              align-self:flex-start;
              margin-bottom:18px;
              padding:8px 12px;
              border:1px solid rgba(35, 53, 78, 0.18);
              background:rgba(219, 227, 238, 0.52);
              color:#23354e;
              font-family:Inter;
              font-size:15px;
              font-weight:700;
              letter-spacing:1.8px;
              text-transform:uppercase;
            "
          >
            Issue under proof
          </div>

          <p
            style="
              display:flex;
              margin:0 0 26px;
              font-family:Inter;
              font-size:30px;
              font-weight:500;
              line-height:1.22;
              color:#524a41;
            "
          >
            ${issue}
          </p>

          <div
            style="
              display:flex;
              flex-direction:column;
              flex:1;
              padding:28px;
              border:1px solid rgba(49, 43, 37, 0.92);
              background:linear-gradient(180deg, rgba(255,255,252,0.9), rgba(242, 237, 229, 0.96));
            "
          >
            <div
              style="
                display:flex;
                align-items:center;
                gap:14px;
                margin-bottom:16px;
                font-family:Inter;
                font-size:16px;
                font-weight:700;
                letter-spacing:1.9px;
                text-transform:uppercase;
                color:#766e65;
              "
            >
              ${conclusionMark}
              Conclusion
            </div>
            <p
              style="
                display:flex;
                margin:0;
                font-family:Lora;
                font-size:${conclusionFontSize}px;
                line-height:${conclusionLineHeight};
                font-weight:700;
                letter-spacing:-0.8px;
              "
            >
              ${conclusion}
            </p>
          </div>
        </div>

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:20px;
            padding:18px 24px;
            border-top:1px solid rgba(197, 190, 180, 0.95);
            background:rgba(244, 239, 231, 0.86);
            font-family:Inter;
            font-size:15px;
            font-weight:500;
            color:#524a41;
          "
        >
          <span>${escapeHtml(footerFacts)}</span>
          <span style="color:#23354e;">${proofUrl}</span>
        </div>
      </div>
    </div>
  `);

  const svg = await satori(markup, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts
  });
  const png = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: CARD_WIDTH
    }
  }).render().asPng();

  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${proofCard.slug}.png`);
  await writeFile(outputPath, png);

  return outputPath;
}
