import type { StorybookConfig } from "@storybook/nextjs";
import path from "path";
import webpack from "webpack";

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)", "../src/app/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  typescript: {
    // react-docgen reads our prop types for the Controls/Docs tables.
    reactDocgen: "react-docgen-typescript",
  },
  webpackFinal: async (cfg) => {
    const authMock = path.resolve(process.cwd(), ".storybook/mocks/auth.ts");
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      // The real auth action is "use server" + Prisma + pg (Node-only). Stub it.
      "@/actions/auth": authMock,
    };
    // Belt-and-suspenders: force any request resolving to actions/auth onto the
    // browser-safe mock, ahead of the Next tsconfig-paths resolver.
    cfg.plugins = cfg.plugins ?? [];
    cfg.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/[/\\]actions[/\\]auth(\.ts)?$/, authMock)
    );
    // Node-only modules that must never enter the browser bundle.
    cfg.resolve.fallback = {
      ...(cfg.resolve.fallback ?? {}),
      net: false,
      tls: false,
      fs: false,
      dns: false,
      pg: false,
      "pg-native": false,
    };
    return cfg;
  },
};

export default config;
