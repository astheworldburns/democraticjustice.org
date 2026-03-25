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

function renderShareEntries(items, options = {}) {
  const {
    markerPrefix = "",
    maxItems = 2,
    maxLength = 88,
    muted = false
  } = options;
  const visibleItems = items.slice(0, maxItems);
  const overflowCount = Math.max(items.length - maxItems, 0);

  const rows = visibleItems.map((item, position) => {
    const markerIndex = item.index || position + 1;
    const textValue = item.premise || item.step || item.text || "";
    const text = escapeHtml(truncateProofText(textValue, maxLength));

    return `
      <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;">
        <span
          style="
            display:flex;
            min-width:28px;
            color:#2e4462;
            font-family:Inter;
            font-size:13px;
            font-weight:700;
            letter-spacing:1.6px;
            text-transform:uppercase;
          "
        >
          ${markerPrefix}${markerIndex}
        </span>
        <span
          style="
            display:flex;
            color:${muted ? "#5b534a" : "#1a1612"};
            font-family:Lora;
            font-size:19px;
            line-height:1.28;
          "
        >
          ${text}
        </span>
      </div>
    `;
  });

  if (overflowCount > 0) {
    rows.push(`
      <div
        style="
          display:flex;
          margin-top:2px;
          color:#5b534a;
          font-family:Inter;
          font-size:13px;
          font-weight:700;
          letter-spacing:1.5px;
          text-transform:uppercase;
        "
      >
        +${overflowCount} more
      </div>
    `);
  }

  return rows.join("");
}

function ghostProofMarkMarkup(size, opacity = 0.08) {
  return `
    <span
      style="
        display:flex;
        position:absolute;
        left:8px;
        top:50%;
        width:${size}px;
        height:${size * 0.72}px;
        transform:translateY(-50%);
        opacity:${opacity};
        pointer-events:none;
      "
    >
      ${proofMarkMarkup(size, Math.round(size * 0.72), "#1a1612")}
    </span>
  `;
}

export async function renderProofShareImage(proofCard, outputDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const siteTitle = escapeHtml(options.siteTitle || proofCard.siteTitle || "Democratic Justice");
  const issueSource = truncateProofText(proofCard.issue, 150);
  const issue = escapeHtml(issueSource);
  const conclusionSource = truncateProofText(proofCard.conclusion, 165);
  const conclusion = escapeHtml(conclusionSource);
  const inference = escapeHtml(truncateProofText(proofCard.inference, 100));
  const footerFacts = `${proofCard.axiomCount} axioms · ${proofCard.logicCount} propositions`;
  const issueFontSize = issueSource.length > 120 ? 28 : 31;
  const conclusionFontSize = conclusionSource.length > 145 ? 31 : conclusionSource.length > 110 ? 35 : 39;
  const conclusionLineHeight = conclusionSource.length > 145 ? 1.08 : 1.06;
  const ghostMark = ghostProofMarkMarkup(176, 0.11);
  const axiomMarkup = renderShareEntries(proofCard.axioms, {
    markerPrefix: "A",
    maxItems: 2,
    maxLength: 86
  });
  const propositionMarkup = renderShareEntries(proofCard.logic, {
    markerPrefix: "P",
    maxItems: 2,
    maxLength: 86,
    muted: true
  });
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(20, 14, "#2e4462");

  const markup = html(`
    <div
      style="
        display:flex;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        padding:34px;
        background:#ece7de;
        color:#1a1612;
      "
    >
      <div
        style="
          display:flex;
          flex:1;
          flex-direction:column;
          border:2px solid rgba(52, 45, 37, 0.94);
          background:#fffdfa;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:24px;
            padding:16px 22px;
            border-bottom:1px solid rgba(185, 177, 166, 0.95);
            font-family:Inter;
            font-size:16px;
            font-weight:700;
            letter-spacing:2.3px;
            text-transform:uppercase;
          "
        >
          <div style="display:flex; align-items:center; gap:12px;">
            ${headerMark}
            <span style="color:#2e4462;">PROOF</span>
          </div>
          <span style="color:#1a1612;">${siteTitle}</span>
        </div>

        <div style="display:flex; flex:1; flex-direction:column; padding:22px 24px 18px;">
          <div
            style="
              display:flex;
              align-self:flex-start;
              margin-bottom:10px;
              color:#2e4462;
              font-family:Inter;
              font-size:14px;
              font-weight:700;
              letter-spacing:1.8px;
              text-transform:uppercase;
            "
          >
            Issue
          </div>

          <p
            style="
              display:flex;
              margin:0;
              font-family:Inter;
              font-size:${issueFontSize}px;
              line-height:1.16;
              font-weight:500;
              letter-spacing:-0.4px;
              color:#1a1612;
            "
          >
            ${issue}
          </p>

          <div
            style="
              display:flex;
              gap:18px;
              margin-top:18px;
              padding-top:18px;
              border-top:1px solid rgba(185, 177, 166, 0.95);
            "
          >
            <div style="display:flex; flex:1; flex-direction:column; padding-right:16px; border-right:1px solid rgba(185, 177, 166, 0.95);">
              <div
                style="
                  display:flex;
                  margin-bottom:12px;
                  color:#2e4462;
                  font-family:Inter;
                  font-size:14px;
                  font-weight:700;
                  letter-spacing:1.8px;
                  text-transform:uppercase;
                "
              >
                Axioms
              </div>
              ${axiomMarkup}
            </div>

            <div style="display:flex; flex:1; flex-direction:column;">
              <div
                style="
                  display:flex;
                  margin-bottom:12px;
                  color:#2e4462;
                  font-family:Inter;
                  font-size:14px;
                  font-weight:700;
                  letter-spacing:1.8px;
                  text-transform:uppercase;
                "
              >
                Propositions
              </div>
              ${propositionMarkup}
              <p
                style="
                  display:flex;
                  margin:6px 0 0;
                  font-family:Lora;
                  font-size:16px;
                  line-height:1.32;
                  color:#5b534a;
                "
              >
                <span style="margin-right:8px; color:#2e4462; font-family:Inter; font-size:13px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase;">Inference:</span>
                <span>${inference}</span>
              </p>
            </div>
          </div>

          <div
            style="
              display:flex;
              flex-direction:column;
              gap:10px;
              margin-top:auto;
              padding-top:16px;
              border-top:1px solid rgba(52, 45, 37, 0.94);
            "
          >
            <div
              style="
                display:flex;
                color:#2e4462;
                font-family:Inter;
                font-size:14px;
                font-weight:700;
                letter-spacing:1.8px;
                text-transform:uppercase;
              "
            >
              Conclusion
            </div>
            <div style="display:flex; position:relative; min-height:126px; overflow:hidden;">
              ${ghostMark}
              <p
                style="
                  display:flex;
                  margin:0;
                  padding-left:104px;
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
        </div>

        <div
          style="
            display:flex;
            justify-content:flex-start;
            align-items:center;
            gap:20px;
            padding:14px 22px;
            border-top:1px solid rgba(185, 177, 166, 0.95);
            background:#f5f1ea;
            font-family:Inter;
            font-size:14px;
            font-weight:700;
            letter-spacing:1.5px;
            text-transform:uppercase;
            color:#5b534a;
          "
        >
          <span>${escapeHtml(footerFacts)}</span>
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
