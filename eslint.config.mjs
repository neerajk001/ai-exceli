import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
          plugins: ["@babel/plugin-syntax-jsx"],
        },
      },
    },
    rules: {
      // The Babel parser is not type-aware, so leave unused checks to `tsc`
      // (`noUnusedLocals` / `noUnusedParameters` in tsconfig.base.json).
      "no-unused-vars": "off",
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  prettier,
];
