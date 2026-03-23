import colors from "tailwindcss/colors";
import typography from "@tailwindcss/typography";

export default {
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
        page: "0 0 0 1px rgba(28, 25, 23, 0.06), 0 18px 60px rgba(28, 25, 23, 0.08)"
      },
      fontFamily: {
        ui: ["Inter", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
        display: ["\"Playfair Display\"", "Merriweather", "Georgia", "serif"]
      },
      letterSpacing: {
        masthead: "-0.05em",
        kicker: "0.18em"
      },
      maxWidth: {
        paper: "80rem"
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: theme("colors.stone.800"),
            maxWidth: "72ch",
            lineHeight: "1.85",
            p: {
              marginTop: "1.2em",
              marginBottom: "1.2em"
            },
            h2: {
              color: theme("colors.stone.950"),
              fontFamily: theme("fontFamily.serif").join(", "),
              fontWeight: "800",
              letterSpacing: "-0.03em",
              lineHeight: "1.2"
            },
            h3: {
              color: theme("colors.stone.950"),
              fontFamily: theme("fontFamily.serif").join(", "),
              fontWeight: "700",
              letterSpacing: "-0.02em",
              lineHeight: "1.25"
            },
            strong: {
              color: theme("colors.stone.950")
            },
            a: {
              color: theme("colors.stone.950"),
              fontWeight: "700",
              textDecorationThickness: "1px",
              textUnderlineOffset: "0.18em"
            },
            blockquote: {
              borderLeftColor: theme("colors.stone.900"),
              borderLeftWidth: "4px",
              color: theme("colors.stone.700"),
              fontFamily: theme("fontFamily.serif").join(", "),
              fontStyle: "italic",
              fontWeight: "400",
              paddingLeft: "1.25rem"
            },
            "blockquote p:first-of-type::before": {
              content: "none"
            },
            "blockquote p:last-of-type::after": {
              content: "none"
            },
            figcaption: {
              color: theme("colors.stone.600"),
              fontFamily: theme("fontFamily.ui").join(", "),
              fontSize: "0.75rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase"
            },
            hr: {
              borderColor: theme("colors.stone.300")
            },
            "ul > li::marker": {
              color: theme("colors.stone.600")
            },
            "ol > li::marker": {
              color: theme("colors.stone.600"),
              fontWeight: "700"
            }
          }
        }
      })
    }
  },
  plugins: [typography]
};

