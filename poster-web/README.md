# G7 海报生成工作台

这是海报项目的内部 Web 工作台原型，不依赖外部 npm 包，使用 Node.js 原生 HTTP 服务。

## 启动

在本机预览：

```bash
node server.js
```

如果当前机器没有全局 Node，可使用 Codex bundled Node：

```bash
/Users/g7e6/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

给局域网同事访问：

```bash
HOST=0.0.0.0 PORT=3000 node server.js
```

同事访问地址：

```text
http://你的电脑IP:3000
```

## 当前功能

- 根据用户需求生成完整生图 Prompt。
- 支持上传参考图、Logo 或二维码，并在 Prompt 中写入参考图清单。
- 必须先生成并确认 Prompt，再生成本地示例海报。
- 查看使用手册，内容来自项目 SOP 与追问规则。
- 查看生图记录，只展示 `生图记录/` 下的图片文件，不展示 Markdown 记录。
- 查看和修改 `优秀海报评估标准.md`。
- 查看和修改 `海报设计建议.md`。
- 使用本地绘制的 G7 风格标识，不依赖外链图片。

## 数据位置

- 生图记录：`../生图记录/`
- 上传参考图：`../参考图上传/`
- 使用手册来源：`../海报生图任务SOP.md`、`../用户追问规则.md`、`../生图提示词模板.md`
- 可编辑文件：`../优秀海报评估标准.md`、`../海报设计建议.md`

## 说明

当前版本是内部 MVP：本地示例海报用于验证流程和记录能力；后续如需接入真实生图模型，可在 `/api/render-local` 后新增真实生图接口，并继续沿用“先 Prompt、再确认/参考图、最后生成并写入生图记录”的 SOP。
