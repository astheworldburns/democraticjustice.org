(() => {
  if (typeof HTMLDialogElement === "undefined" || typeof HTMLDialogElement.prototype.showModal !== "function") {
    return;
  }

  const records = new Map();
  let drawer;
  let title;
  let status;
  let body;
  let recordLink;
  let fileLink;
  let closeButton;
  let controller;
  let requestNumber = 0;
  let readingPosition;
  let trigger;
  const canonicalOrigin = (() => {
    try {
      const canonical = new URL(document.querySelector('link[rel~="canonical"]')?.href || location.href);
      return ["http:", "https:"].includes(canonical.protocol) && !canonical.username && !canonical.password
        ? canonical.origin : location.origin;
    } catch {
      return location.origin;
    }
  })();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function localUrl(value, base) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      if (url.origin === location.origin && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
        return url;
      }
    } catch {
      // Missing or unsupported source URLs retain the normal document link.
    }
    return null;
  }

  function documentUrl(link) {
    try {
      const url = new URL(link.getAttribute("href"), location.href);
      if (![location.origin, canonicalOrigin].includes(url.origin) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        return null;
      }
      if (!/^\/documents\/[^/]+\/$/.test(url.pathname)) return null;
      // Canonical absolute citations should still read the current deployment's
      // source record in a branch preview. The original href remains the fallback.
      return new URL(`${url.pathname}${url.search}`, location.origin);
    } catch {
      return null;
    }
  }

  function lockReadingPosition() {
    const properties = ["position", "top", "left", "width", "overflow", "paddingRight"];
    const styles = Object.fromEntries(properties.map((property) => [property, document.body.style[property]]));
    readingPosition = { x: window.scrollX, y: window.scrollY, styles };
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    Object.assign(document.body.style, {
      position: "fixed",
      top: `${-readingPosition.y}px`,
      left: `${-readingPosition.x}px`,
      width: "100%",
      overflow: "hidden",
      paddingRight: `${padding + gutter}px`
    });
  }

  function restoreReadingPosition() {
    if (!readingPosition) return;
    const saved = readingPosition;
    readingPosition = null;
    Object.assign(document.body.style, saved.styles);
    const scrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
    document.documentElement.style.scrollBehavior = scrollBehavior;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }

  function createDrawer() {
    drawer = element("dialog", "evidence-drawer");
    drawer.dataset.evidenceDrawer = "";
    drawer.setAttribute("aria-labelledby", "evidence-drawer-title");

    const header = element("header", "evidence-drawer__header");
    const top = element("div", "evidence-drawer__top");
    top.append(element("p", "evidence-drawer__eyebrow", "Source document"));
    closeButton = element("button", "evidence-drawer__close", "Close");
    closeButton.type = "button";
    closeButton.dataset.evidenceClose = "";
    closeButton.setAttribute("aria-label", "Close source preview and return to the article");
    closeButton.addEventListener("click", () => drawer.close());
    top.append(closeButton);
    title = element("h2", "evidence-drawer__title", "Source document");
    title.id = "evidence-drawer-title";
    status = element("p", "evidence-drawer__status");
    status.dataset.evidenceStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    header.append(top, title, status);

    body = element("div", "evidence-drawer__body");
    body.dataset.evidenceBody = "";
    const footer = element("footer", "evidence-drawer__footer");
    recordLink = element("a", "evidence-drawer__record-link", "Open document");
    recordLink.dataset.evidenceRecordLink = "";
    recordLink.target = "_blank";
    recordLink.rel = "noopener noreferrer";
    fileLink = element("a", "evidence-drawer__file-link", "Open full file");
    fileLink.dataset.evidenceFileLink = "";
    fileLink.target = "_blank";
    fileLink.rel = "noopener noreferrer";
    fileLink.hidden = true;
    footer.append(recordLink, fileLink);
    drawer.append(header, body, footer);

    // Native dialogs provide focus trapping, Escape handling, and background
    // inertness. A backdrop click is outside the panel's rectangle.
    drawer.addEventListener("click", (event) => {
      if (event.target !== drawer) return;
      const bounds = drawer.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        drawer.close();
      }
    });
    drawer.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
      )).filter((node) => node.tabIndex >= 0 && !node.closest("[hidden]") && node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // Native modal inertness protects the article, but some browsers include
      // browser chrome in their Tab cycle. Keep the source controls predictable.
      if (!first || (event.shiftKey ? active === first : active === last) || !focusable.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus({ preventScroll: true });
      }
    });
    drawer.addEventListener("close", () => {
      requestNumber += 1;
      controller?.abort();
      controller = null;
      body.replaceChildren();
      restoreReadingPosition();
    });
    document.body.append(drawer);
  }

  function parseRecord(html, url) {
    const page = new DOMParser().parseFromString(html, "text/html");
    const source = page.querySelector("[data-source-record]");
    if (!source) throw new Error("Source record not found");
    const data = source.dataset;
    const file = localUrl(data.sourceFileUrl, url);
    const preview = localUrl(data.sourcePreview, url);
    return {
      title: data.sourceTitle || "Source document",
      description: data.sourceDescription || "",
      obtained: data.sourceObtained || "",
      method: data.sourceMethod || "",
      file: file?.href || "",
      fileType: data.sourceFileType || "",
      preview: preview && /\.(?:png|jpe?g|gif|webp|avif)$/i.test(preview.pathname) ? preview.href : ""
    };
  }

  function renderRecord(record) {
    title.textContent = record.title;
    status.textContent = "";
    body.replaceChildren();
    if (record.description) body.append(element("p", "evidence-drawer__description", record.description));
    if (record.obtained || record.method) {
      const provenance = element("dl", "evidence-drawer__provenance");
      for (const [label, value] of [["Obtained", record.obtained], ["Source method", record.method]]) {
        if (!value) continue;
        const row = element("div", "evidence-drawer__provenance-row");
        row.append(element("dt", "", label), element("dd", "", value));
        provenance.append(row);
      }
      body.append(provenance);
    }

    const file = localUrl(record.file, location.href);
    const imageFile = file && /\.(?:png|jpe?g|gif|webp|avif)$/i.test(file.pathname) ? file.href : "";
    const preview = record.preview || (record.fileType === "image" ? imageFile : "");
    if (preview) {
      const figure = element("figure", "evidence-drawer__preview");
      const image = element("img", "evidence-drawer__preview-image");
      image.src = preview;
      image.alt = `${record.fileType === "pdf" ? "First page of" : "Preview of"} ${record.title}`;
      image.decoding = "async";
      image.loading = "lazy";
      image.addEventListener("error", () => {
        figure.replaceChildren(element("p", "evidence-drawer__notice", "The preview could not load. Open the document to view the complete source."));
      }, { once: true });
      figure.append(image);
      if (record.fileType === "pdf") {
        figure.append(element("figcaption", "evidence-drawer__caption", "First-page preview. Open the full file for the complete record."));
      }
      body.append(figure);
    } else if (file && record.fileType === "pdf" && /\.pdf$/i.test(file.pathname)) {
      const frame = element("iframe", "evidence-drawer__preview-frame");
      frame.src = `${file.href.split("#")[0]}#view=FitH`;
      frame.title = `PDF preview: ${record.title}`;
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      body.append(frame);
    } else {
      body.append(element("p", "evidence-drawer__notice", "Open the document record to view the complete source."));
    }

    fileLink.hidden = !file;
    if (file) fileLink.href = file.href;
    else fileLink.removeAttribute("href");
    drawer.dataset.state = "ready";
  }

  function openDrawer(url, link) {
    if (!drawer) createDrawer();
    if (!drawer.open) {
      trigger = link;
      lockReadingPosition();
      try {
        drawer.showModal();
      } catch {
        restoreReadingPosition();
        return false;
      }
    }

    const currentRequest = ++requestNumber;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    drawer.dataset.state = "loading";
    title.textContent = link.getAttribute("title") || link.textContent.trim() || "Source document";
    status.textContent = "Loading source…";
    body.replaceChildren();
    fileLink.hidden = true;
    fileLink.removeAttribute("href");
    recordLink.href = url.href;
    closeButton.focus({ preventScroll: true });

    if (records.has(url.href)) {
      renderRecord(records.get(url.href));
      return true;
    }
    fetch(url.href, { signal, credentials: "same-origin", redirect: "error", headers: { Accept: "text/html" } })
      .then((response) => {
        if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) throw new Error("Source unavailable");
        return response.text();
      })
      .then((html) => {
        if (signal.aborted || currentRequest !== requestNumber || !drawer.open) return;
        const record = parseRecord(html, url.href);
        if (records.size >= 20) records.delete(records.keys().next().value);
        records.set(url.href, record);
        renderRecord(record);
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted || currentRequest !== requestNumber || !drawer.open) return;
        drawer.dataset.state = "error";
        status.textContent = "This preview could not be loaded. Use Open document to view the source.";
        body.replaceChildren();
      });
    return true;
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[data-doc-url], .article-prose a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = documentUrl(link);
    if (url && openDrawer(url, link)) event.preventDefault();
  });
})();
