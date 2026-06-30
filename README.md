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
- 使用 IndexedDB 在浏览器本地保存文件夹、日记、转写文本和录音 Blob。
- 支持文件夹、标题、固定日期组件、搜索、Markdown 工具栏和 `/` 块命令。
- 长录音时可点击“保存当前分段”，把当前音频和转写保存为独立片段。
- 支持 PWA manifest 和 service worker，可在手机浏览器里添加到主屏幕。

## 注意

语音转写依赖浏览器支持。Safari/Firefox 可能只能录音，不能实时中文转写。录音和日记数据保存在当前浏览器本地，清除站点数据会删除内容。

手机端要完整使用录音权限，建议发布到 HTTPS 地址。本地局域网 HTTP 地址可以预览界面，但部分手机浏览器会拦截麦克风权限。
