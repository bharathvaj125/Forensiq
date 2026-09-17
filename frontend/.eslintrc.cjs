/**
 * ESLint configuration for the frontend.
 * NOTE: Scaffold placeholder - tune rules during Milestone 0.
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["react-hooks"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
};
