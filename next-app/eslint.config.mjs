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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The booking app's committed build output (FIN-DEP03). Linting a minified bundle
    // produced ~1,200 of the ~1,260 problems and made `npm run lint` useless as a gate.
    "public/**",
  ]),
  {
    // Plain <a> for internal links is deliberate in these three files: a client boundary for
    // every CTA would cost hydration on all 2,513 pages (see CtaButtons.tsx). The rule stays
    // on everywhere else.
    files: ["components/shared/Header.tsx", "components/shared/Footer.tsx", "components/seo/SeoPage.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);

export default eslintConfig;
