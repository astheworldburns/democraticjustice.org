function normalizePath(value = "") {
  return value.replace(/^\.\//, "");
}

export default class AdminProofDocuments {
  data() {
    return {
      permalink: "/admin/proof/data/documents.json"
    };
  }

  render({ collections }) {
    const items = (collections.sourceDocument || []).map((document) => ({
      slug: document.fileSlug,
      title: document.data?.title || document.fileSlug,
      description: document.data?.description || "",
      obtained: document.data?.obtained || "",
      source_method: document.data?.source_method || "",
      url: document.url || `/documents/${document.fileSlug}/`,
      file_url: document.data?.file || "",
      repo_path: normalizePath(document.inputPath || "")
    }));

    return JSON.stringify(items, null, 2);
  }
}
