/* Design Token System — see docs/CONTENT-MODEL.md for architecture */
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.njk", "./src/**/*.md", "./src/**/*.js", "./src/**/*.11ty.js", "./src/**/*.html"],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1.5" }],
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.55" }],
        base: ["1rem", { lineHeight: "1.65" }],
        lg: ["1.125rem", { lineHeight: "1.55" }],
        xl: ["1.25rem", { lineHeight: "1.4" }],
        "2xl": ["1.5rem", { lineHeight: "1.3" }],
        "3xl": ["1.875rem", { lineHeight: "1.2" }],
        "4xl": ["2.25rem", { lineHeight: "1.1" }],
        "5xl": ["3rem", { lineHeight: "1.05" }],
        "6xl": ["3.75rem", { lineHeight: "1" }],
        "display-sm": ["clamp(1.875rem, 1.5rem + 1vw, 2.25rem)", { lineHeight: "1.15" }],
        "display-md": ["clamp(2.25rem, 1.8rem + 1.5vw, 3rem)", { lineHeight: "1.1" }],
        "display-lg": ["clamp(3rem, 2rem + 2.5vw, 3.75rem)", { lineHeight: "1.05" }]
      },
      boxShadow: {
        panel: "0 1px 0 rgba(20, 21, 24, 0.06), 0 14px 40px rgba(20, 21, 24, 0.08)",
        elevated: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "elevated-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        glass: "0 2px 16px rgba(0,0,0,0.06)"
      },
      fontFamily: {
        ui: ["\"Space Grotesk\"", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        sans: ["\"Space Grotesk\"", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        serif: ["\"Source Serif 4\"", "Georgia", "serif"],
        display: ["\"Source Serif 4\"", "Georgia", "serif"],
        mono: ["\"IBM Plex Mono\"", "\"SFMono-Regular\"", "Menlo", "monospace"]
      },
      borderRadius: {
        squircle: "1rem",
        "squircle-lg": "1.5rem",
        "squircle-sm": "0.625rem"
      },
      backdropBlur: {
        glass: "12px"
      },
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          elevated: "var(--color-surface-elevated)",
          overlay: "var(--color-surface-overlay)"
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          secondary: "var(--color-ink-secondary)",
          muted: "var(--color-ink-muted)"
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          subtle: "var(--color-accent-subtle)"
        },
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)"
        },
        glass: {
          bg: "var(--color-glass-bg)",
          border: "var(--color-glass-border)"
        }
      },
      keyframes: {
        rise: {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        }
      },
      animation: {
        rise: "rise 500ms cubic-bezier(0.2, 0.65, 0.2, 1) both"
      },
      letterSpacing: {
        kicker: "0.16em"
      },
      maxWidth: {
        paper: "88rem",
        measure: "68ch"
      },
      typography: {
        DEFAULT: {
          css: {
            color: "rgb(var(--ink-soft))",
            maxWidth: "68ch",
            lineHeight: "1.75",
            p: {
              marginTop: "1em",
              marginBottom: "1em"
            },
            h1: {
              color: "rgb(var(--ink))",
              fontFamily: "\"Source Serif 4\", Georgia, serif",
              fontWeight: "700",
              fontSize: "clamp(2rem, 1.5rem + 1.7vw, 3.05rem)",
              letterSpacing: "-0.03em",
              lineHeight: "1",
              marginTop: "1.2em",
              marginBottom: "0.65em"
            },
            h2: {
              color: "rgb(var(--ink))",
              fontFamily: "\"Source Serif 4\", Georgia, serif",
              fontWeight: "700",
              fontSize: "clamp(1.55rem, 1.15rem + 1.2vw, 2.1rem)",
              letterSpacing: "-0.03em",
              lineHeight: "1.1",
              marginTop: "1.5em",
              marginBottom: "0.6em"
            },
            h3: {
              color: "rgb(var(--ink))",
              fontFamily: "\"Source Serif 4\", Georgia, serif",
              fontWeight: "700",
              fontSize: "clamp(1.15rem, 1rem + 0.6vw, 1.45rem)",
              letterSpacing: "-0.02em",
              lineHeight: "1.16"
            },
            strong: {
              color: "rgb(var(--ink))"
            },
            a: {
              color: "rgb(var(--ink))",
              fontWeight: "600",
              textDecorationThickness: "1px",
              textUnderlineOffset: "0.18em"
            },
            blockquote: {
              borderLeftColor: "rgb(var(--rule-strong))",
              borderLeftWidth: "2px",
              color: "rgb(var(--ink-soft))",
              fontFamily: "\"Source Serif 4\", Georgia, serif",
              fontStyle: "italic",
              fontWeight: "400",
              paddingLeft: "1rem"
            },
            "blockquote p:first-of-type::before": {
              content: "none"
            },
            "blockquote p:last-of-type::after": {
              content: "none"
            },
            img: {
              borderRadius: "0"
            },
            figure: {
              margin: "0"
            },
            figcaption: {
              borderTopColor: "rgb(var(--rule))",
              borderTopStyle: "solid",
              borderTopWidth: "1px",
              color: "rgb(var(--ink-muted))",
              fontFamily: "\"IBM Plex Mono\", \"SFMono-Regular\", Menlo, monospace",
              fontSize: "0.75rem",
              lineHeight: "1.5",
              marginTop: "0.5rem",
              paddingTop: "0.45rem"
            },
            hr: {
              borderColor: "rgb(var(--rule))"
            },
            "ul > li::marker": {
              color: "rgb(var(--ink-muted))"
            },
            "ol > li::marker": {
              color: "rgb(var(--ink-muted))",
              fontWeight: "700"
            }
          }
        }
      }
    }
  },
  plugins: [typography]
};
