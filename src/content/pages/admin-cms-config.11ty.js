import { readFile } from "node:fs/promises";
import yaml from "js-yaml";

export default class AdminCmsConfig {
  data() {
    return {
      permalink: "/admin/cms/data/config.json"
    };
  }

  async render() {
    const rawConfig = await readFile("./src/admin/cms/config.yml", "utf8");
    const parsed = yaml.load(rawConfig) || {};

    return JSON.stringify(parsed, null, 2);
  }
}
