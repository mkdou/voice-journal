const MAX_TEXT_LENGTH = 12000;

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

  if (!process.env.DASHSCOPE_API_KEY) {
    res.status(500).json({ error: "缺少阿里云百炼环境变量 DASHSCOPE_API_KEY。" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const text = String(body?.text || "").trim();

    if (!text) {
      res.status(400).json({ error: "没有可整理的转写文字。" });
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      res.status(413).json({ error: "这段转写太长，请先拆成更短的录音片段。" });
      return;
    }

    const response = await fetch(dashScopeChatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.PUNCTUATION_MODEL || "qwen-plus",
        messages: [
          {
            role: "system",
            content: [
              "你是中文日记转写整理助手。",
              "只为用户提供的中文口语转写添加自然的逗号、句号、问号、感叹号和必要分段。",
              "不要总结，不要润色成书面语，不要增加新内容，不要删改原意。",
              "如果原文包含英文、数字或专有名词，尽量保持原样。"
            ].join("")
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1
      })
    });

    const result = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: readableDashScopeError(response.status, result) });
      return;
    }

    const polished = result?.choices?.[0]?.message?.content?.trim() || "";
    res.status(200).json({ text: polished || text });
  } catch (error) {
    res.status(500).json({ error: error.message || "整理标点失败。" });
  }
}

function dashScopeChatCompletionsUrl() {
  const baseUrl = process.env.DASHSCOPE_BASE_URL
    || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://mkdou.github.io";
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readableDashScopeError(status, result) {
  const message = result?.message || result?.error?.message || result?.code;
  if (status === 401) return "阿里云 API Key 无效，请检查 Vercel 环境变量 DASHSCOPE_API_KEY。";
  if (status === 429) return "阿里云百炼额度不足或请求过快，请检查百炼控制台额度。";
  return message || "阿里云百炼整理标点失败。";
}
