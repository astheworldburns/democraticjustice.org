function normalizePath(value = "") {
  return value.replace(/^\.\//, "");
}

export default class AdminProofArticles {
  data() {
    return {
      permalink: "/admin/proof/data/articles.json"
    };
  }

  render({ collections }) {
    const items = (collections.articleFile || []).map((article) => ({
      slug: article.fileSlug,
      title: article.data?.title || article.fileSlug,
      description: article.data?.description || "",
      author: article.data?.author || "",
      date: article.data?.date || null,
      url: article.url || "",
      repo_path: normalizePath(article.inputPath || ""),
      proof: article.data?.proof || null
    }));

    return JSON.stringify(items, null, 2);
  }
}
