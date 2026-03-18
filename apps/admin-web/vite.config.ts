import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

function parseAllowedHosts(value?: string): string[] | true | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "*" || normalized.toLowerCase() === "true") {
    return true;
  }

  return normalized
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

const frontendHost = process.env.FRONTEND_HOST || "0.0.0.0";
const frontendPort = Number(process.env.FRONTEND_PORT) || 3000;
const frontendAllowedHosts = parseAllowedHosts(process.env.FRONTEND_ALLOWED_HOSTS);
const frontendProxyTarget = process.env.FRONTEND_DEV_PROXY_TARGET || "http://localhost:8000";
const devSecurityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls,
      },
    }),
    vuetify({
      autoImport: true,
    }),
  ],
  server: {
    port: frontendPort,
    host: frontendHost,
    allowedHosts: frontendAllowedHosts,
    headers: devSecurityHeaders,
    proxy: {
      "/api": {
        target: frontendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    // Vuetify ships modern CSS that jsdom does not fully parse; stubbing CSS
    // imports keeps component tests focused on behavior instead of stylesheet noise.
    css: false,
    environment: "jsdom",
    globals: true,
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
    setupFiles: "./src/test/setup.ts",
  },
});
