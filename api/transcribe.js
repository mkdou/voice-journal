const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const audioBase64 = body?.audioBase64;
    const mimeType = body?.mimeType || "audio/webm";
    const filename = body?.filename || "recording.webm";
    const language = body?.language || "zh";

    if (!audioBase64) {
      res.status(400).json({ error: "Missing audioBase64" });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      res.status(413).json({ error: "Audio is too large" });
      return;
    }

    const formData = new FormData();
    formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe");
    formData.append("language", language);
    formData.append("response_format", "json");
    formData.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      filename
    );

    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const result = await openaiResponse.json();
    if (!openaiResponse.ok) {
      res.status(openaiResponse.status).json({
        error: readableOpenAIError(openaiResponse.status, result?.error?.message)
      });
      return;
    }

    res.status(200).json({ text: result.text || "" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Transcription failed" });
  }
}

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://mkdou.github.io";
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readableOpenAIError(status, message) {
  if (status === 401) return "OpenAI API key 无效，请重新生成并更新 Vercel 环境变量 OPENAI_API_KEY。";
  if (status === 429) return "OpenAI API 额度不足或账单未开启，请检查 OpenAI Platform 的 Billing 和 Usage。";
  return message || "OpenAI transcription failed";
}
