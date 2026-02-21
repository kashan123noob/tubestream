import express from "express";
import { createServer as createViteServer } from "vite";
import ytdl from "@distube/ytdl-core";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API to get video info
  app.get("/api/info", async (req, res) => {
    const videoURL = req.query.url as string;
    if (!videoURL) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      if (!ytdl.validateURL(videoURL)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await ytdl.getInfo(videoURL);
      const formats = ytdl.filterFormats(info.formats, "videoandaudio");
      
      res.json({
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
        formats: formats.map(f => ({
          quality: f.qualityLabel,
          container: f.container,
          url: f.url,
          hasVideo: f.hasVideo,
          hasAudio: f.hasAudio
        }))
      });
    } catch (error: any) {
      console.error("Error fetching info:", error);
      res.status(500).json({ error: error.message || "Failed to fetch video info" });
    }
  });

  // API to download/stream video
  app.get("/api/download", async (req, res) => {
    const videoURL = req.query.url as string;
    const quality = req.query.quality as string || "highest";

    if (!videoURL) {
      return res.status(400).send("URL is required");
    }

    try {
      if (!ytdl.validateURL(videoURL)) {
        return res.status(400).send("Invalid YouTube URL");
      }

      const info = await ytdl.getInfo(videoURL);
      const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "").replace(/[\/\\?%*:|"<>]/g, "");
      
      res.header("Content-Disposition", `attachment; filename="${title}.mp4"`);
      
      ytdl(videoURL, {
        quality: quality === "highest" ? "highestvideo" : quality,
        filter: "videoandaudio"
      }).pipe(res);

    } catch (error: any) {
      console.error("Error downloading:", error);
      res.status(500).send("Failed to download video");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
