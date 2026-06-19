import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = __dirname;
const sharedReactPath = path.resolve(projectRoot, "node_modules/react");
const sharedReactDomPath = path.resolve(projectRoot, "node_modules/react-dom");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const marketPublicDir = path.resolve(workspaceRoot, "frontend_market", "public");

const copyDirSync = (src, dest) => {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

// Plugin to serve frontend_market/public as static files
const marketPublicPlugin = {
  name: "market-public-static",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const raw = req.url?.split("?")[0] || "";
      let url;
      try { url = decodeURIComponent(raw); } catch { url = raw; }
      const filePath = path.join(marketPublicDir, url);
      if (
        url !== "/" &&
        !url.startsWith("/@") &&
        !url.startsWith("/api") &&
        !url.startsWith("/src") &&
        !url.startsWith("/node_modules") &&
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile()
      ) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          ".glb": "model/gltf-binary",
          ".gltf": "model/gltf+json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
        };
        const mime = mimeTypes[ext] || "application/octet-stream";
        res.setHeader("Content-Type", mime);
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      next();
    });
  },
  closeBundle() {
    const outDir = path.resolve(projectRoot, "dist");
    copyDirSync(marketPublicDir, outDir);
  },
};

export default defineConfig({
  plugins: [tailwindcss(), react(), marketPublicPlugin],
  resolve: {
    alias: {
      react: sharedReactPath,
      "react/jsx-runtime": path.resolve(sharedReactPath, "jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(sharedReactPath, "jsx-dev-runtime.js"),
      "react-dom": sharedReactDomPath,
      "react-dom/client": path.resolve(sharedReactDomPath, "client.js"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
