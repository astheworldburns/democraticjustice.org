import * as pdfjsLib from "/assets/vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdfjs/pdf.worker.mjs";

const reader = document.querySelector("[data-pdf-reader]");

if (reader) {
  const pdfUrl = reader.dataset.pdfUrl;
  const canvas = reader.querySelector("[data-pdf-canvas]");
  const stage = reader.querySelector("[data-pdf-stage]");
  const status = reader.querySelector("[data-pdf-status]");
  const previousButton = reader.querySelector("[data-pdf-previous]");
  const nextButton = reader.querySelector("[data-pdf-next]");
  const context = canvas.getContext("2d");

  let documentHandle;
  let pageNumber = 1;
  let renderTask;

  const updateControls = () => {
    previousButton.disabled = !documentHandle || pageNumber <= 1;
    nextButton.disabled = !documentHandle || pageNumber >= documentHandle.numPages;
  };

  const renderPage = async () => {
    if (!documentHandle) {
      return;
    }

    if (renderTask) {
      renderTask.cancel();
    }

    status.textContent = `Loading page ${pageNumber} of ${documentHandle.numPages}…`;

    const page = await documentHandle.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(280, stage.clientWidth - 48);
    const displayScale = Math.min(1.6, availableWidth / baseViewport.width);
    const outputScale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: displayScale });

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    renderTask = page.render({
      canvasContext: context,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport
    });

    try {
      await renderTask.promise;
      status.textContent = `Page ${pageNumber} of ${documentHandle.numPages}`;
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") {
        throw error;
      }
    } finally {
      renderTask = null;
      updateControls();
    }
  };

  previousButton.addEventListener("click", () => {
    if (pageNumber > 1) {
      pageNumber -= 1;
      renderPage();
    }
  });

  nextButton.addEventListener("click", () => {
    if (documentHandle && pageNumber < documentHandle.numPages) {
      pageNumber += 1;
      renderPage();
    }
  });

  try {
    documentHandle = await pdfjsLib.getDocument(pdfUrl).promise;
    updateControls();
    await renderPage();
  } catch (error) {
    console.error("Unable to load the challenge PDF.", error);
    status.textContent = "The embedded reader could not load.";
    stage.innerHTML = `
      <p class="max-w-xl self-center text-center">
        The embedded reader could not load.
        <a href="${pdfUrl}" target="_blank" rel="noopener">Open the challenge PDF directly</a>.
      </p>
    `;
  }
}
