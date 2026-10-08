import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" }
  },
  {
    rules: {
      // 1. Allow console.log for local debugging and dev servers
      "no-console": "off",

      // 2. Turn off errors for unused function parameters starting with "_"
      // (Super useful for Express middleware like: (err, req, res, next))
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

      // 3. Force strict equality checks (===) to prevent type coercion bugs
      "eqeqeq": ["error", "always"],

      // 4. Warn if you forget to use 'await' or return inside an async function
      "require-await": "warn"
    }
  }
]);