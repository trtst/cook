import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  clearImmediate: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  exports: "readonly",
  module: "readonly",
  process: "readonly",
  require: "readonly",
  setImmediate: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly"
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "unpackage/**", "src/unpackage/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        sourceType: "module"
      },
      globals: {
        uni: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "vue/multi-word-component-names": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off"
    }
  },
  {
    files: ["src/**/*.test.js", "src/**/*.test.cjs", "src/test-utils/**/*.js", "src/env.js", "src/jest.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["src/**/*.test.js", "src/**/*.test.cjs"],
    languageOptions: {
      globals: {
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        jest: "readonly",
        program: "readonly"
      }
    }
  }
];
