(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const searchRoot = document.getElementById("news-search");

    if (!searchRoot || !window.PagefindUI) {
      return;
    }

    new window.PagefindUI({
      element: "#news-search",
      showEmptyFilters: false,
      showSubResults: true,
      excerptLength: 24,
      resetStyles: false,
      translations: {
        placeholder: "Search the archive"
      }
    });
  });
})();
