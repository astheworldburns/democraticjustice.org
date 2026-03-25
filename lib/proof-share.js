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
    .replace(/>/g, "&gt;");
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
      <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
        <span
          style="
            display:flex;
            width:28px;
            height:28px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            background:#2b231d;
            color:#f7f2e8;
            font-family:Inter;
            font-size:13px;
            font-weight:700;
            letter-spacing:1.1px;
            text-transform:uppercase;
          "
        >
          ${markerPrefix}${markerIndex}
        </span>
        <span
          style="
            display:flex;
            color:${muted ? "#5b534a" : "#201a15"};
            font-family:Inter;
            font-size:16px;
            font-weight:700;
            line-height:1.3;
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
        left:0;
        top:4px;
        width:${size}px;
        height:${size * 0.72}px;
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
  const footerFacts = `${proofCard.axiomCount} axioms · ${proofCard.logicCount} inferences`;
  const issueFontSize = issueSource.length > 126 ? 27 : issueSource.length > 90 ? 30 : 33;
  const conclusionFontSize = conclusionSource.length > 145 ? 27 : conclusionSource.length > 118 ? 30 : 33;
  const conclusionLineHeight = conclusionSource.length > 145 ? 1.08 : 1.05;
  const ghostMark = ghostProofMarkMarkup(176, 0.11);
  const axiomMarkup = renderShareEntries(proofCard.axioms, {
    markerPrefix: "A",
    maxItems: 2,
    maxLength: 56
  });
  const propositionMarkup = renderShareEntries(proofCard.logic, {
    markerPrefix: "I",
    maxItems: 2,
    maxLength: 56,
    muted: true
  });
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(20, 14, "#f7f2e8");

  const markup = html(`
    <div
      style="
        display:flex;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        padding:34px;
        background:#e7dfd3;
        color:#201a15;
      "
    >
      <div
        style="
          display:flex;
          flex:1;
          flex-direction:column;
          gap:0;
        "
      >
        <div
          style="
            display:flex;
            flex:1;
            flex-direction:column;
            gap:16px;
            padding:18px;
            border:2px solid rgba(39, 33, 28, 0.96);
            border-radius:28px;
            background:#f1ebe1;
            box-shadow:inset 0 0 0 1px rgba(68, 60, 52, 0.14);
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:18px;
            "
          >
            <div
              style="
                display:flex;
                align-items:center;
                gap:12px;
                padding:14px 18px;
                border-radius:18px;
                background:#2b231d;
                color:#f7f2e8;
              "
            >
              ${headerMark}
              <span
                style="
                  display:flex;
                  font-family:Inter;
                  font-size:16px;
                  font-weight:700;
                  letter-spacing:2.3px;
                  text-transform:uppercase;
                "
              >
                Proof
              </span>
            </div>
            <div
              style="
                display:flex;
                padding:10px 14px;
                border:1px solid rgba(68, 60, 52, 0.22);
                border-radius:999px;
                background:rgba(255, 255, 255, 0.42);
                color:#5b534a;
                font-family:Inter;
                font-size:14px;
                font-weight:700;
                letter-spacing:2px;
                text-transform:uppercase;
              "
            >
              ${escapeHtml(footerFacts)}
            </div>
          </div>

          <div
            style="
              display:flex;
              flex:1;
              flex-direction:column;
              gap:16px;
            "
          >
            <div
              style="
                display:flex;
                flex-direction:column;
                gap:10px;
                padding:18px;
                border:1px solid rgba(68, 60, 52, 0.22);
                border-radius:20px;
                background:rgba(32, 26, 21, 0.08);
              "
            >
              <div
                style="
                  display:flex;
                  color:#675b4f;
                  font-family:Inter;
                  font-size:13px;
                  font-weight:700;
                  letter-spacing:2.1px;
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
                  line-height:0.96;
                  font-weight:700;
                  letter-spacing:-1.1px;
                  color:#201a15;
                "
              >
                ${issue}
              </p>
            </div>

            <div
              style="
                display:flex;
                gap:16px;
                flex:1;
              "
            >
              <div
                style="
                  display:flex;
                  flex:1;
                  flex-direction:column;
                  gap:12px;
                  padding:16px;
                  border:1px solid rgba(68, 60, 52, 0.22);
                  border-radius:20px;
                  background:rgba(255, 255, 255, 0.42);
                  overflow:hidden;
                "
              >
                <div
                  style="
                    display:flex;
                    color:#675b4f;
                    font-family:Inter;
                    font-size:13px;
                    font-weight:700;
                    letter-spacing:2.1px;
                    text-transform:uppercase;
                  "
                >
                  Axioms
                </div>
                ${axiomMarkup}
              </div>

              <div
                style="
                  display:flex;
                  flex:1;
                  flex-direction:column;
                  gap:12px;
                  padding:16px;
                  border:1px solid rgba(68, 60, 52, 0.22);
                  border-radius:20px;
                  background:rgba(255, 255, 255, 0.42);
                  overflow:hidden;
                "
              >
                <div
                  style="
                    display:flex;
                    color:#675b4f;
                    font-family:Inter;
                    font-size:13px;
                    font-weight:700;
                    letter-spacing:2.1px;
                    text-transform:uppercase;
                  "
                >
                  Inferences
                </div>
                ${propositionMarkup}
              </div>
            </div>

            <div
              style="
                display:flex;
                flex-direction:column;
                gap:10px;
                padding:18px;
                border:1px solid rgba(68, 60, 52, 0.22);
                border-radius:20px;
                background:rgba(32, 26, 21, 0.08);
              "
            >
              <div
                style="
                  display:flex;
                  color:#675b4f;
                  font-family:Inter;
                  font-size:13px;
                  font-weight:700;
                  letter-spacing:2.1px;
                  text-transform:uppercase;
                "
              >
                Conclusion
              </div>
              <div style="display:flex; position:relative; min-height:112px; overflow:hidden;">
                ${ghostMark}
                <p
                  style="
                    display:flex;
                    margin:0;
                    padding-left:100px;
                    font-family:Lora;
                    font-size:${conclusionFontSize}px;
                    line-height:${conclusionLineHeight};
                    font-weight:700;
                    letter-spacing:-0.8px;
                    color:#201a15;
                  "
                >
                  ${conclusion}
                </p>
              </div>
            </div>

            <div
              style="
                display:flex;
                justify-content:flex-start;
                align-items:center;
                gap:18px;
                padding:0 2px;
                color:#5b534a;
                font-family:Inter;
                font-size:13px;
                font-weight:700;
                letter-spacing:1.7px;
                text-transform:uppercase;
              "
            >
              <span>${siteTitle}</span>
            </div>
          </div>
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
