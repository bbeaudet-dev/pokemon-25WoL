import next from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: ["convex/_generated/**"],
  },
  ...next,
];

export default config;
