import puppeteer from "@cloudflare/puppeteer";

const PREVIEW_SUFFIX = ".preview.webp";

function isPdfKey(key = "") {
  return key.toLowerCase().endsWith(".pdf");
}

function previewKeyFor(pdfKey = "") {
  return `${pdfKey.replace(/\.pdf$/i, "")}${PREVIEW_SUFFIX}`;
}

function previewUrlFor(key) {
  return `/documents/${key.split("/").pop()}`;
}

async function renderPdfFirstPageToWebp(pdfBytes, env) {
  const browser = await puppeteer.launch(env.BROWSER);

  try {
    const page = await browser.newPage();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.25 });
    await page.goto(dataUrl, { waitUntil: "networkidle2" });
    await page.waitForTimeout(750);

    const image = await page.screenshot({
      type: "webp",
      quality: 86,
      clip: { x: 0, y: 0, width: 1200, height: 1600 }
    });

    return image;
  } finally {
    await browser.close();
  }
}

async function processPdfObject(key, env) {
  if (!isPdfKey(key)) {
    return { skipped: true, reason: "not_pdf", key };
  }

  const pdfObject = await env.DOCS_BUCKET.get(key);

  if (!pdfObject) {
    return { skipped: true, reason: "missing_source", key };
  }

  const pdfBytes = await pdfObject.arrayBuffer();
  const previewBytes = await renderPdfFirstPageToWebp(pdfBytes, env);
  const previewKey = previewKeyFor(key);
  const previewUrl = previewUrlFor(previewKey);

  await env.DOCS_BUCKET.put(previewKey, previewBytes, {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  await env.DOCS_BUCKET.put(key, pdfBytes, {
    httpMetadata: pdfObject.httpMetadata,
    customMetadata: {
      ...(pdfObject.customMetadata || {}),
      preview_image: previewUrl,
      preview_generated_at: new Date().toISOString()
    }
  });

  return {
    skipped: false,
    key,
    previewKey,
    previewUrl
  };
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Use POST with JSON body: {\"keys\": [\"foo.pdf\"]}", { status: 405 });
    }

    const payload = await request.json().catch(() => ({}));
    const keys = Array.isArray(payload.keys) ? payload.keys : [];

    if (!keys.length) {
      return Response.json({ enqueued: 0, message: "No keys provided." }, { status: 400 });
    }

    const url = new URL(request.url);
    const directMode = url.pathname === "/render-now" || payload.mode === "direct";

    if (directMode) {
      const results = [];

      for (const key of keys) {
        try {
          results.push(await processPdfObject(key, env));
        } catch (error) {
          results.push({ key, error: error instanceof Error ? error.message : String(error) });
        }
      }

      return Response.json({ processed: results.length, results });
    }

    await env.PREVIEW_QUEUE.sendBatch(keys.map((key) => ({ body: { key } })));
    return Response.json({ enqueued: keys.length });
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      const key = message.body?.key;

      if (!key) {
        message.ack();
        continue;
      }

      try {
        const result = await processPdfObject(key, env);
        console.log("preview-job", result);
        message.ack();
      } catch (error) {
        console.error("preview-job-failed", key, error);
        message.retry();
      }
    }
  }
};
