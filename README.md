# Voice Journal

一个本地优先的语音日记原型：录音、中文实时转写、录音分段保存、文件夹管理和 Markdown 编辑。

## 运行

```bash
python3 -m http.server 4174
```

然后打开：

```text
http://127.0.0.1:4174
```

## 功能

- 使用 `MediaRecorder` 保存每篇日记的录音片段。
- 使用 Chrome/Edge 的 Web Speech API 做 `zh-CN` 实时转写。
- 支持点击录音分段的“生成准确转写”，把该段音频上传到后端并用 OpenAI 转写模型生成准确稿。
- 使用 IndexedDB 在浏览器本地保存文件夹、日记、转写文本和录音 Blob。
- 支持文件夹、标题、固定日期组件、搜索、Markdown 工具栏和 `/` 块命令。
- 长录音时可点击“保存当前分段”，把当前音频和转写保存为独立片段。
- 支持 PWA manifest 和 service worker，可在手机浏览器里添加到主屏幕。

## 注意

语音转写依赖浏览器支持。Safari/Firefox 可能只能录音，不能实时中文转写。录音和日记数据保存在当前浏览器本地，清除站点数据会删除内容。

手机端要完整使用录音权限，建议发布到 HTTPS 地址。本地局域网 HTTP 地址可以预览界面，但部分手机浏览器会拦截麦克风权限。

当前实时转写使用浏览器内置 Web Speech API，适合作为“实时草稿”。如果需要更高准确率的中文转写，下一步应接入服务端转写，例如 Whisper/OpenAI transcription，并在录音保存后上传音频生成准确稿。

## 准确转写后端

GitHub Pages 只能托管静态网页，不能安全保存 OpenAI API key。准确转写需要单独部署 `api/transcribe.js`，例如部署到 Vercel。

环境变量：

```text
OPENAI_API_KEY=你的 OpenAI API key
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
ALLOWED_ORIGIN=https://mkdou.github.io
```

手机端第一次点击“生成准确转写”时，如果网页运行在 GitHub Pages，会提示粘贴后端地址，例如：

```text
https://your-vercel-app.vercel.app/api/transcribe
```

只有点击“生成准确转写”时，对应录音分段才会上传到后端；平时录音、日记、草稿转写仍保存在当前设备本地浏览器。
