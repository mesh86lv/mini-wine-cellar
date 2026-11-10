// Tailwind CSS v4 is a PostCSS plugin, not a `next.config` loader: without this file the
// `@import "tailwindcss"` in `src/app/globals.css` produces no CSS at all.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
