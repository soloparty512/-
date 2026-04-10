import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for LINE Notify
  app.post("/api/notify", async (req, res) => {
    const { message, token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "LINE Token is required" });
    }

    try {
      const response = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${token}`,
        },
        body: new URLSearchParams({ message }),
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error("LINE Notify Error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // API Route for Email Notification
  app.post("/api/email", async (req, res) => {
    const { subject, text, html, config } = req.body;

    if (!config || !config.enabled) {
      return res.status(400).json({ error: "Email configuration is missing or disabled" });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${config.fromEmail}" <${config.smtpUser}>`,
        to: config.toEmail,
        subject: subject,
        text: text,
        html: html,
      });

      console.log("Email sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Email Error:", error);
      res.status(500).json({ error: "Failed to send email notification" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
