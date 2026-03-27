import adminProof from "../../_data/adminProof.json" with { type: "json" };

export default class AdminEditorConfig {
  data() {
    return {
      permalink: "/admin/editor/data/config.json"
    };
  }

  render() {
    return JSON.stringify(
      {
        editor_api_base_url: adminProof?.proof_api_base_url || ""
      },
      null,
      2
    );
  }
}
