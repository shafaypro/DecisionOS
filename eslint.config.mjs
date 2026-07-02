import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "app-temp/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "storybook-static/**",
  ]),
  {
    rules: {
      // Allow underscore-prefixed names as "intentionally unused" - the standard
      // TypeScript convention for discarded destructure targets (_score, _unused).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // react-hooks@7 introduced stricter rules about setState in effects and ref
      // access during render. Downgrade to "warn" so pre-existing patterns that are
      // intentional (close-drawer-on-nav, reset-dismissed-on-title-change) don't
      // block the build. Files that have real bugs should be fixed separately.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
