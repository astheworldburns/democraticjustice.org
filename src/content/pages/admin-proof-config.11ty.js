import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import adminProof from "../../_data/adminProof.json" with { type: "json" };

export default class AdminProofConfig {
  data() {
    return {
      permalink: "/admin/proof/data/config.json"
    };
  }

  async render() {
    const rawConfig = await readFile("./src/admin/config.yml", "utf8");
    const parsed = yaml.load(rawConfig) || {};
    const repoValue = parsed.backend?.repo || "";
    const [repoOwner = "", repoName = ""] = repoValue.split("/");

    return JSON.stringify(
      {
        repo_owner: repoOwner,
        repo_name: repoName,
        branch: parsed.backend?.branch || "main",
        base_url: parsed.backend?.base_url || "",
        proof_api_base_url: adminProof?.proof_api_base_url || "",
        article_content_path: "src/content/articles/",
        document_content_path: "src/content/documents/",
        document_asset_path: "static/documents/"
      },
      null,
      2
    );
  }
}
