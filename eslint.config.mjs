import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // TODO(lint-burn-down): ~45 pre-existing react-hooks sites (mostly the
  // setLoading(true)-at-fetch-start effect pattern) predate the CI lint
  // gate. Downgraded to warn so CI can enforce everything else; fix in a
  // dedicated pass, then re-promote to error. Review the purity/
  // immutability warnings first — those can be real bugs.
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // One-off ingest/maintenance scripts are held to a softer standard than
  // app code: keep the signal visible as warnings without blocking CI.
  {
    files: ["scripts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
