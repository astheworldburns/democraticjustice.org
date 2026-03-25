<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/> RSS Feed</title>
        <style>
          :root {
            color-scheme: light dark;
            --page: #13100e;
            --panel: #1d1815;
            --paper: #f3ede3;
            --ink: #1f1a16;
            --ink-soft: #5a5046;
            --ink-reverse: #f5eee4;
            --rule: rgba(69, 60, 52, 0.2);
            --rule-strong: #2a231e;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --page: #0f0d0b;
              --panel: #171311;
              --paper: #201a17;
              --ink: #f2e8da;
              --ink-soft: #cdbfad;
              --ink-reverse: #f5eee4;
              --rule: rgba(242, 232, 218, 0.12);
              --rule-strong: rgba(242, 232, 218, 0.28);
            }
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
            <p class="kicker">RSS Feed</p>
            <h1><xsl:value-of select="rss/channel/title"/></h1>
            <p class="dek">
              This is the machine-readable RSS feed for Democratic Justice. If you were expecting a normal webpage, start with the RSS guide instead.
            </p>
            <div class="actions">
              <a class="button" href="/rss/">How to use RSS</a>
              <a class="button" href="{rss/channel/link}">Open site</a>
            </div>
            <p class="note">
              Paste this feed URL into any RSS reader to subscribe: <code><xsl:value-of select="rss/channel/atom:link/@href"/></code>
            </p>

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
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
