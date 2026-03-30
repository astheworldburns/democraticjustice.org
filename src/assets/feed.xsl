<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en" data-theme="light">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/> RSS Feed</title>
        <script>
          (() => {
            const storageKey = "dj-theme";
            const storedTheme = localStorage.getItem(storageKey);
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            document.documentElement.dataset.theme = storedTheme || systemTheme;
          })();
        </script>
                <style>
          /* Colors match design tokens in tailwind.css — update both if palette changes */
          :root {
            --page: #f4f7fc;
            --panel: #ffffff;
            --paper: #ffffff;
            --ink: #141b26;
            --ink-soft: #414c5c;
            --ink-reverse: #f4f7fc;
            --rule: rgba(20, 27, 38, 0.2);
            --rule-strong: #cfd9e8;
          }

          html[data-theme="light"] {
            color-scheme: light;
            --page: #f4f7fc;
            --panel: #ffffff;
            --paper: #ffffff;
            --ink: #141b26;
            --ink-soft: #414c5c;
            --ink-reverse: #f4f7fc;
            --rule: rgba(20, 27, 38, 0.2);
            --rule-strong: #cfd9e8;
          }

          html[data-theme="dark"] {
            color-scheme: dark;
            --page: #0f151f;
            --panel: #182130;
            --paper: #182130;
            --ink: #ecf0f7;
            --ink-soft: #c6cfdd;
            --ink-reverse: #f4f7fc;
            --rule: rgba(236, 240, 247, 0.12);
            --rule-strong: rgba(236, 240, 247, 0.28);
          }

          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: var(--page);
            color: var(--ink);
            font-family: Georgia, "Times New Roman", serif;
            line-height: 1.55;
          }
          .shell {
            max-width: 74rem;
            margin: 0 auto;
            padding: 1rem;
          }
          .panel {
            border: 1px solid var(--rule-strong);
            background: var(--paper);
            padding: 1.5rem;
          }
          .masthead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--rule-strong);
          }
          .brand {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            color: inherit;
            text-decoration: none;
          }
          .brand-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: Inter, Arial, sans-serif;
            font-size: 1.15rem;
            font-weight: 800;
            letter-spacing: 0.08em;
          }
          .brand-copy {
            display: flex;
            flex-direction: column;
            gap: 0;
          }
          .brand-name {
            font-size: clamp(1.15rem, 2vw, 1.45rem);
            font-weight: 700;
            line-height: 1;
          }
          .masthead-actions {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
          }
          .intro {
            margin-top: 1.15rem;
          }
          .kicker {
            margin: 0;
            font-family: Inter, Arial, sans-serif;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: var(--ink-soft);
          }
          h1 {
            margin: 0.4rem 0 0;
            font-size: clamp(2rem, 4vw, 3.5rem);
            line-height: 0.98;
          }
          .dek {
            max-width: 44rem;
            margin: 1rem 0 0;
            font-size: 1.1rem;
            color: var(--ink-soft);
          }
          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1.25rem;
          }
          .button {
            display: inline-flex;
            align-items: center;
            border: 1px solid var(--rule-strong);
            padding: 0.8rem 1rem;
            color: inherit;
            text-decoration: none;
            font-family: Inter, Arial, sans-serif;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }
          .theme-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--rule-strong);
            padding: 0.8rem 1rem;
            background: transparent;
            color: inherit;
            font-family: Inter, Arial, sans-serif;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            cursor: pointer;
          }
          .items {
            display: grid;
            gap: 1rem;
            margin-top: 1.5rem;
          }
          .item {
            border: 1px solid var(--rule);
            padding: 1.1rem 1.1rem 1rem;
          }
          .meta {
            margin: 0 0 0.55rem;
            font-family: Inter, Arial, sans-serif;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--ink-soft);
          }
          .item-title {
            margin: 0;
            font-size: 1.4rem;
            line-height: 1.05;
          }
          .item-title a {
            color: inherit;
            text-decoration: none;
          }
          .item-title a:hover {
            text-decoration: underline;
            text-underline-offset: 0.15em;
          }
          .item-description {
            margin: 0.75rem 0 0;
            color: var(--ink-soft);
          }
          .note {
            margin-top: 1rem;
            font-family: Inter, Arial, sans-serif;
            font-size: 0.84rem;
            color: var(--ink-soft);
          }
          code {
            font-family: "SFMono-Regular", Consolas, monospace;
            font-size: 0.95em;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="panel">
            <div class="masthead">
              <a class="brand" href="{rss/channel/link}">
                <span class="brand-mark">[∴]</span>
                <span class="brand-copy">
                  <span class="brand-name"><xsl:value-of select="rss/channel/title"/></span>
                </span>
              </a>
              <div class="masthead-actions">
                <a class="button" href="{rss/channel/link}">Homepage</a>
                <button class="theme-toggle" type="button" data-theme-toggle="true">Night edition</button>
              </div>
            </div>
            <div class="intro">
            <h1>RSS feed</h1>
            <p class="dek">
              This is the live Democratic Justice feed. Use it if you want new work without the noise.
            </p>
            <div class="actions">
              <a class="button" href="/rss/">RSS guide</a>
              <a class="button" href="{rss/channel/link}">Homepage</a>
            </div>
            <p class="note">
              Paste this feed URL into your RSS reader: <code><xsl:value-of select="rss/channel/atom:link/@href"/></code>
            </p>
            </div>

            <div class="items">
              <xsl:for-each select="rss/channel/item">
                <article class="item">
                  <p class="meta"><xsl:value-of select="pubDate"/></p>
                  <h2 class="item-title">
                    <a href="{link}"><xsl:value-of select="title"/></a>
                  </h2>
                  <p class="item-description"><xsl:value-of select="description"/></p>
                </article>
              </xsl:for-each>
            </div>
          </div>
        </div>
        <script>
          (() => {
            const storageKey = "dj-theme";
            const root = document.documentElement;
            const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const toggle = document.querySelector("[data-theme-toggle]");

            function preferredTheme() {
              const storedTheme = localStorage.getItem(storageKey);
              if (storedTheme) {
                return storedTheme;
              }

              return systemQuery.matches ? "dark" : "light";
            }

            function syncToggle(theme) {
              if (!toggle) {
                return;
              }

              toggle.textContent = theme === "dark" ? "Day edition" : "Night edition";
            }

            function applyTheme(theme) {
              root.dataset.theme = theme;
              syncToggle(theme);
            }

            applyTheme(preferredTheme());

            if (toggle) {
              toggle.addEventListener("click", () => {
                const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
                localStorage.setItem(storageKey, nextTheme);
                applyTheme(nextTheme);
              });
            }

            systemQuery.addEventListener("change", (event) => {
              if (!localStorage.getItem(storageKey)) {
                applyTheme(event.matches ? "dark" : "light");
              }
            });
          })();
        </script>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
