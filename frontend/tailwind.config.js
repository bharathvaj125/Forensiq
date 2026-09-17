/**
 * Tailwind CSS configuration.
 * Purpose: design system tokens, content paths for purge/JIT, and the
 * high-contrast "field mode" theme extension (SAD Section 4.4).
 * Used by: postcss build pipeline / all components.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // brand / severity / field-mode tokens to be defined in Milestone 2
      },
    },
  },
  plugins: [],
};
