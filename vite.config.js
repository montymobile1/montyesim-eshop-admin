import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // To read the package.json file
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const env = loadEnv(mode, __dirname);

  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")
  );

  return {
    plugins: [tailwindcss(), react(), eslint()],
    server: {
      open: true,
      port: Number.parseInt(env.VITE_PORT),
      hmr: true,
      hot: true,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/tests/setup.js"],
      include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
      coverage: {
        reporter: ["text", "lcov", "html"],
        all: true,
        include: ["src/**/*.{js,jsx,ts,tsx}"],
        exclude: [
          "**/*.test.{js,jsx,ts,tsx}",
          "**/node_modules/**",
          "**/mocks/**",
        ],
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "axios", "formik"],
          },
        },
      },
      target: "esnext",
      sourcemap: false,
      outDir: `build`,
      minify: "esbuild",
    },
    assetsInclude: ["**/*.xlsx"],
    define: {
      __APP_ENV__: JSON.stringify(mode),
      __APP_VERSION__: JSON.stringify(packageJson.version),
      ...Object.keys(env).reduce((prev, key) => {
        prev[`process.env.${key}`] = JSON.stringify(env[key]);
        return prev;
      }, {}),
    },
  };
});
