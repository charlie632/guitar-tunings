import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const theoryBoundary = {
  patterns: [
    {
      group: ["**/theory/*", "!**/theory/index", "!**/theory/index.ts"],
      message: "Import theory only through src/theory/index.ts. The Exploration is already bound to tuning and capo.",
    },
  ],
};

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/audio/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": ["error", theoryBoundary],
    },
  },
);
