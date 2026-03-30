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
            font-family:Space Grotesk;
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
            color:${muted ? "#626872" : "#17191d"};
            font-family:Space Grotesk;
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
          color:#626872;
          font-family:Space Grotesk;
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
      ${proofMarkMarkup(size, Math.round(size * 0.72), "#17191d")}
    </span>
  `;
}

export async function renderProofShareImage(proofCard, outputDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const siteTitle = escapeHtml(options.siteTitle || proofCard.siteTitle || "Democratic Justice");
  const issueSource = truncateProofText(proofCard.issue, 112);
  const issue = escapeHtml(issueSource);
  const conclusionSource = truncateProofText(proofCard.qed || proofCard.conclusion, 152);
  const conclusion = escapeHtml(conclusionSource);
  const footerFacts = `${proofCard.axiomCount} axioms · ${proofCard.theoremCount || proofCard.logicCount} theorems · ${proofCard.sourceDocumentCount} documents`;
  const issueFontSize = issueSource.length > 98 ? 25 : issueSource.length > 74 ? 28 : 31;
  const conclusionFontSize = conclusionSource.length > 132 ? 28 : conclusionSource.length > 110 ? 31 : 34;
  const conclusionLineHeight = conclusionSource.length > 132 ? 1.1 : 1.06;
  const ghostMark = ghostProofMarkMarkup(176, 0.11);
  const axiomMarkup = renderShareEntries(proofCard.axioms, {
    markerPrefix: "A",
    maxItems: 1,
    maxLength: 68
  });
  const propositionMarkup = renderShareEntries(proofCard.theorems || proofCard.logic, {
    markerPrefix: "T",
    maxItems: 1,
    maxLength: 68,
    muted: true
  });
  const fonts = await loadFonts(projectRoot);
  const headerMark = proofMarkMarkup(20, 14, "#f7f8fa");

  const markup = html(`
    <div
      style="
        display:flex;
        width:${CARD_WIDTH}px;
        height:${CARD_HEIGHT}px;
        padding:34px;
        background:#e4e7ec;
        color:#17191d;
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
            border:2px solid rgba(31, 34, 39, 0.94);
            border-radius:28px;
            background:#f5f6f8;
            box-shadow:inset 0 0 0 1px rgba(77, 84, 93, 0.1);
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
                background:#1f2227;
                color:#f7f8fa;
              "
            >
              ${headerMark}
              <span
                style="
                  display:flex;
                  font-family:Space Grotesk;
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
                border:1px solid rgba(77, 84, 93, 0.2);
                border-radius:999px;
                background:rgba(255, 255, 255, 0.68);
                color:#616871;
                font-family:Space Grotesk;
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
              gap:14px;
            "
          >
            <div
              style="
                display:flex;
                flex-direction:column;
                gap:8px;
                padding:18px;
                border:1px solid rgba(77, 84, 93, 0.2);
                border-radius:20px;
                background:rgba(20, 22, 26, 0.05);
              "
            >
              <div
                style="
                  display:flex;
                  color:#666d77;
                  font-family:Space Grotesk;
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
                  font-family:Space Grotesk;
                  font-size:${issueFontSize}px;
                  line-height:1;
                  font-weight:600;
                  letter-spacing:-0.9px;
                  color:#17191d;
                "
              >
                ${issue}
              </p>
            </div>

            <div
              style="
                display:flex;
                gap:16px;
                align-items:stretch;
              "
            >
              <div
                style="
                  display:flex;
                  flex:1;
                  flex-direction:column;
                  gap:10px;
                  padding:14px 16px;
                  border:1px solid rgba(77, 84, 93, 0.2);
                  border-radius:20px;
                  background:rgba(255, 255, 255, 0.68);
                  overflow:hidden;
                "
              >
                <div
                  style="
                    display:flex;
                    color:#666d77;
                    font-family:Space Grotesk;
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
                  gap:10px;
                  padding:14px 16px;
                  border:1px solid rgba(77, 84, 93, 0.2);
                  border-radius:20px;
                  background:rgba(255, 255, 255, 0.68);
                  overflow:hidden;
                "
              >
                <div
                  style="
                    display:flex;
                    color:#666d77;
                    font-family:Space Grotesk;
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
                flex:1;
                gap:10px;
                padding:18px;
                border:1px solid rgba(77, 84, 93, 0.2);
                border-radius:20px;
                background:rgba(20, 22, 26, 0.05);
              "
            >
              <div
                style="
                  display:flex;
                  color:#666d77;
                  font-family:Space Grotesk;
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
                    font-family:Source Serif 4;
                    font-size:${conclusionFontSize}px;
                    line-height:${conclusionLineHeight};
                    font-weight:700;
                    letter-spacing:-0.8px;
                    color:#17191d;
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
                color:#616871;
                font-family:Space Grotesk;
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
