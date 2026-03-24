import colors from "tailwindcss/colors";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{njk,md,html,js}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      stone: colors.stone,
      zinc: colors.zinc,
      slate: colors.slate
    },
    extend: {
      boxShadow: {
        page: "0 0 0 1px rgba(28, 25, 23, 0.06), 0 24px 90px rgba(12, 10, 9, 0.12)"
      },
      fontFamily: {
        ui: ["Inter", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
        display: ["\"Playfair Display\"", "Merriweather", "Georgia", "serif"]
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
        masthead: "-0.05em",
        kicker: "0.18em"
      },
      maxWidth: {
        paper: "82rem",
        measure: "72ch"
      },
      typography: {
        DEFAULT: {
          css: {
            color: "rgb(var(--ink-soft))",
            maxWidth: "72ch",
            lineHeight: "1.82",
            p: {
              marginTop: "1.15em",
              marginBottom: "1.15em"
            },
            h2: {
              color: "rgb(var(--ink))",
              fontFamily: "\"Playfair Display\", Merriweather, Georgia, serif",
              fontWeight: "800",
              fontSize: "clamp(1.75rem, 1.15rem + 1.4vw, 2.4rem)",
              letterSpacing: "-0.03em",
              lineHeight: "1.08",
              marginTop: "1.7em",
              marginBottom: "0.7em"
            },
            h3: {
              color: "rgb(var(--ink))",
              fontFamily: "Merriweather, Georgia, serif",
              fontWeight: "700",
              fontSize: "clamp(1.35rem, 1rem + 0.8vw, 1.75rem)",
              letterSpacing: "-0.02em",
              lineHeight: "1.18"
            },
            strong: {
              color: "rgb(var(--ink))"
            },
            a: {
              color: "rgb(var(--ink))",
              fontWeight: "700",
              textDecorationThickness: "1px",
              textUnderlineOffset: "0.18em"
            },
            blockquote: {
              borderLeftColor: "rgb(var(--rule-strong))",
              borderLeftWidth: "4px",
              color: "rgb(var(--ink-soft))",
              fontFamily: "Merriweather, Georgia, serif",
              fontStyle: "italic",
              fontWeight: "400",
              paddingLeft: "1.35rem"
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
              borderTopColor: colors.gray[300],
              borderTopStyle: "solid",
              borderTopWidth: "1px",
              color: colors.gray[500],
              fontFamily: "Inter, \"Helvetica Neue\", Arial, sans-serif",
              fontSize: "0.78rem",
              fontStyle: "italic",
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
