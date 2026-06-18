const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");
const RECORD_DIR = path.join(ROOT, "生图记录");
const REFERENCE_DIR = path.join(ROOT, "参考图上传");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

const editableFiles = {
  rubric: "优秀海报评估标准.md",
  design: "海报设计建议.md",
};

const textFiles = {
  sop: "海报生图任务SOP.md",
  question: "用户追问规则.md",
  knowledge: "产品知识库.md",
  selling: "卖点表达库.md",
  prompt: "生图提示词模板.md",
  index: "资料索引.md",
};

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) {
        req.destroy();
        reject(new Error("request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeName(name) {
  return String(name || "").replace(/[^\w\u4e00-\u9fa5.-]+/g, "_").slice(0, 80);
}

function imageType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function parseReferences(input) {
  return Array.isArray(input)
    ? input
        .map((item) => ({
          name: safeName(item.name || "参考图"),
          url: String(item.url || ""),
          type: String(item.type || "image"),
        }))
        .filter((item) => item.name && item.url)
        .slice(0, 6)
    : [];
}

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function matchScenario(demand) {
  const text = demand || "";
  const rules = [
    {
      keywords: ["猪", "仔猪", "活猪", "急刹", "急转", "野蛮驾驶", "应激"],
      industry: "农牧-猪只运输",
      scene: "EMS急加速、急刹车、风险入弯等",
      audience: "育苗企业、猪只运输承运商、物流负责人",
      pain: "司机激进驾驶易导致仔猪惊恐堆叠、挤压踩踏致死，直接拉高运输损耗率。",
      value: "AI 实时识别并纠正急刹、急转、风险入弯等激进驾驶行为，提前预警并帮助管理者及时干预。",
      visual: "活猪运输车急刹/急转的真实行业场景，车厢半透明剖面呈现猪只堆叠风险，旁侧叠加 AI 驾驶行为监测面板。",
    },
    {
      keywords: ["危化", "右转", "不停车", "罐车"],
      industry: "危化行业",
      scene: "风险地图-右转不停车",
      audience: "危化车队老板、安全员、合规负责人",
      pain: "危化罐车右转盲区大，司机不停车观察易引发碾轧事故和合规处罚。",
      value: "风险地图提前识别高危路口，车机预警提醒停车观察，平台留证形成管理闭环。",
      visual: "危化罐车右转路口，右侧盲区高亮，叠加车机预警和平台风险提示。",
    },
    {
      keywords: ["冷链", "温度", "超温", "失温", "SOP", "交付"],
      industry: "冷链行业",
      scene: "全链路主动治理",
      audience: "冷链货主、车队、承运商管理者",
      pain: "单一温度曲线无法覆盖货物状态变化、末端交接和 SOP 执行风险。",
      value: "从温度曲线升级到货物全程视频实景，AI 主动识别异常并形成交付闭环。",
      visual: "冷链车、货厢视频实景、温度曲线、SOP 节点与 AI 预警界面组合。",
    },
    {
      keywords: ["饲料", "偷盗", "掺假", "注水", "车顶", "车侧", "车尾"],
      industry: "农牧-饲料防偷盗",
      scene: "管货防偷盗",
      audience: "饲料企业、农牧集团、物流稽查人员",
      pain: "饲料在途偷盗、掺假、注水和摄像头遮挡隐蔽，传统稽查取证难、成本高。",
      value: "AI 识别人员接触、画面遮挡、异常停留等疑似偷盗风险，高危事件实时推送并留证。",
      visual: "饲料运输车车侧/车顶/车尾关键节点监控，异常人员接触与遮挡风险高亮。",
    },
    {
      keywords: ["城配", "货损", "货箱", "装卸", "看手机", "快递", "快运"],
      industry: "城配行业",
      scene: "安全&货损双维监控",
      audience: "城配车队、快递快运企业、运营安全负责人",
      pain: "城配同时面临安全事故和货损压力，城市路况复杂、货箱异常和分心驾驶频发。",
      value: "AI 同时识别驾驶风险与货损风险，货损可溯、风险可视，帮助降低赔付和客户投诉。",
      visual: "城配车辆、货箱开门/装卸场景、驾驶风险与货损监控双屏信息。",
    },
    {
      keywords: ["大宗", "钢铁", "新能源", "重卡", "红灯司机"],
      industry: "大宗-钢铁新能源车队",
      scene: "安全管理",
      audience: "新能源重卡车队老板、安全员、调度",
      pain: "新能源重卡起步快、重载惯性大，规模扩张后传统人盯人安全管理失效。",
      value: "AI 识别高危事件和红灯司机，生成整改任务，支撑车队稳健扩张。",
      visual: "新能源重卡在国省道路/钢厂场景中行驶，叠加司机安全分和风险预警面板。",
    },
  ];
  return rules.find((rule) => rule.keywords.some((k) => text.includes(k))) || {
    industry: "临时需求",
    scene: "用户自定义海报",
    audience: "待确认受众",
    pain: "用户需求信息较少，需要根据补充素材和目标场景建立一次性 Brief。",
    value: "先输出完整生图 Prompt，用户确认或上传参考图后再执行生图。",
    visual: "根据用户需求构建主视觉，避免虚构产品事实和效果承诺。",
  };
}

function extractTitles(demand) {
  const titleMatch = demand.match(/标题[:：]\s*([^\n]+)/);
  const subtitle = demand
    .split(/副标题[:：]/)[1]
    ?.split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
  return {
    title: titleMatch ? titleMatch[1].replace(/活禽/g, "活猪").trim() : "",
    subtitles: subtitle && subtitle.length ? subtitle.map((s) => s.replace(/活禽/g, "活猪")) : [],
  };
}

function makePrompt(demand, options = {}) {
  const scenario = matchScenario(demand);
  const extracted = extractTitles(demand);
  const references = parseReferences(options.references);
  const title = extracted.title || `让${scenario.scene}风险在事故前被看见`;
  const subtitles = extracted.subtitles.length
    ? extracted.subtitles
    : [
        scenario.value,
        "车机预警、平台推送、实时干预，形成从识别到处置的闭环。",
      ];
  const referenceText = references.length
    ? `用户已上传参考图，生成时必须结合参考图理解风格、构图、主体元素或 Logo/二维码要求。\n参考图清单：\n${references.map((item, index) => `${index + 1}. ${item.name}（${item.url}）`).join("\n")}\n若参考图与文案冲突，以用户确认的主副标题和业务事实为准。`
    : options.hasReference
    ? "用户表示后续会上传参考图：当前 Prompt 先作为基础版本，正式生图前需补充参考图，并明确哪些元素必须保留。"
    : "暂无参考图：先生成符合行业真实感的场景，不虚构具体客户 Logo 或真实事故画面。用户确认前可上传参考图、产品图、Logo 或二维码。";

  return `请生成一张高质量中文产品宣传海报。

【海报目标】
围绕“${scenario.industry} / ${scenario.scene}”生成一张 B2B 产品宣传海报，让目标用户快速理解痛点、产品能力和业务价值。

【目标受众】
${scenario.audience}

【行业与场景】
行业：${scenario.industry}
场景：${scenario.scene}

【核心痛点】
${scenario.pain}

【产品价值】
${scenario.value}

【主标题】
${title}

【副标题】
1. ${subtitles[0] || ""}
2. ${subtitles[1] || ""}

【必须出现的信息】
G7 易流 / 紫宝盒 AI 主动治理。暂不放二维码和联系方式，除非用户后续上传。

【主视觉设计】
${scenario.visual}

【构图要求】
主标题置于首屏视觉焦点区域，副标题紧随其后；中部使用真实行业场景作为主视觉，右侧或下方叠加 AI 识别、风险预警、平台推送等产品能力界面；底部保留品牌信息与三项价值卡片。

【视觉风格】
科技感、专业可信、真实场景感、B2B 行业解决方案气质。整体克制、清晰、现代，不做娱乐化或过度装饰。

【品牌与配色】
以黑、白、灰为主色；紫色 #4e0ea5 与青色 #03cdb8 作为小面积点缀色。整体保持高级、干净、科技感。中文字体风格参考 MiSans，英文字体风格参考 Poppins。

【参考素材使用方式】
${referenceText}

【优秀海报评估标准】
生成结果必须满足：
1. 第一眼有视觉吸引力，3 秒内能抓住核心信息。
2. 信息层级清楚，主标题 → 副标题 → 细节信息顺序明确。
3. 主标题聚焦一个核心亮点，副标题补充产品特色、场景或价值。
4. 画面与文案相互呼应，能够准确表达真实行业场景和痛点。
5. 品牌识别清晰，整体风格符合黑白灰主色、紫色与青色点缀的品牌气质。
6. 文字克制，不堆砌信息，留白得当。
7. 画面专业，无明显字体、排版、比例、元素瑕疵。

【负面约束】
不要信息堆砌；不要文字过小；不要错别字；不要虚构产品参数、客户名称或效果承诺；不要使用无关装饰；不要让 Logo、二维码、车辆、屏幕文字变形；不要把画面做成泛泛的科技背景而缺少真实行业场景；不要使用过度花哨或娱乐化风格。

【输出规格】
竖版 4:5，适合内部测试和移动端查看。`;
}

function serveStatic(req, res) {
  const raw = decodeURIComponent(req.url.split("?")[0]);
  let filePath = raw === "/" ? path.join(PUBLIC, "index.html") : path.join(PUBLIC, raw);
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, { error: "forbidden" });
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, { error: "not found" });
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    }[ext] || "application/octet-stream";
    send(res, 200, buf, type);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/health") return send(res, 200, { ok: true, root: ROOT });

  if (url.pathname === "/api/records") {
    const files = fs.existsSync(RECORD_DIR)
      ? fs.readdirSync(RECORD_DIR)
          .filter((n) => /\.(png|jpe?g|webp|svg)$/i.test(n))
          .sort()
          .reverse()
          .map((name) => ({ name, url: `/records/${encodeURIComponent(name)}` }))
      : [];
    return send(res, 200, { files });
  }

  if (url.pathname.startsWith("/records/")) {
    const name = path.basename(decodeURIComponent(url.pathname.replace("/records/", "")));
    const file = path.join(RECORD_DIR, name);
    if (!file.startsWith(RECORD_DIR) || !fs.existsSync(file)) return send(res, 404, { error: "not found" });
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".svg" ? "image/svg+xml" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    return send(res, 200, fs.readFileSync(file), type);
  }

  if (url.pathname === "/api/references") {
    const files = fs.existsSync(REFERENCE_DIR)
      ? fs.readdirSync(REFERENCE_DIR)
          .filter((n) => /\.(png|jpe?g|webp|gif|svg)$/i.test(n))
          .sort()
          .reverse()
          .map((name) => ({ name, url: `/references/${encodeURIComponent(name)}` }))
      : [];
    return send(res, 200, { files });
  }

  if (url.pathname.startsWith("/references/")) {
    const name = path.basename(decodeURIComponent(url.pathname.replace("/references/", "")));
    const file = path.join(REFERENCE_DIR, name);
    if (!file.startsWith(REFERENCE_DIR) || !fs.existsSync(file)) return send(res, 404, { error: "not found" });
    return send(res, 200, fs.readFileSync(file), imageType(file));
  }

  const fileGet = url.pathname.match(/^\/api\/file\/(rubric|design)$/);
  if (fileGet && req.method === "GET") {
    const file = path.join(ROOT, editableFiles[fileGet[1]]);
    return send(res, 200, { name: editableFiles[fileGet[1]], content: fs.readFileSync(file, "utf8") });
  }

  if (fileGet && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const file = path.join(ROOT, editableFiles[fileGet[1]]);
    fs.writeFileSync(file, String(body.content || ""), "utf8");
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/manual") {
    const payload = {};
    for (const [key, file] of Object.entries({ sop: textFiles.sop, question: textFiles.question, prompt: textFiles.prompt, index: textFiles.index })) {
      payload[key] = fs.readFileSync(path.join(ROOT, file), "utf8");
    }
    return send(res, 200, payload);
  }

  if (url.pathname === "/api/prompt" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const demand = String(body.demand || "");
    const references = parseReferences(body.references);
    const prompt = makePrompt(demand, { hasReference: Boolean(body.hasReference), references });
    const scenario = matchScenario(demand);
    return send(res, 200, {
      scenario,
      title: extractTitles(demand).title || `让${scenario.scene}风险在事故前被看见`,
      prompt,
      nextStep: references.length
        ? "请检查完整 Prompt 中的参考图清单。确认无误后，可点击“确认并生成本地示例海报”。"
        : "请先检查完整 Prompt。确认无误后，可上传参考图/Logo/二维码并重新生成 Prompt，或点击“确认并生成本地示例海报”。",
    });
  }

  if (url.pathname === "/api/upload-reference" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const match = String(body.dataUrl || "").match(/^data:(image\/(?:png|jpe?g|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return send(res, 400, { error: "only base64 image data urls are supported" });
    const mime = match[1].replace("image/jpg", "image/jpeg");
    const ext = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/svg+xml": ".svg",
    }[mime];
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 8_000_000) return send(res, 400, { error: "image must be smaller than 8MB" });
    if (!fs.existsSync(REFERENCE_DIR)) fs.mkdirSync(REFERENCE_DIR, { recursive: true });
    const original = safeName(body.name || `参考图${ext}`).replace(/\.(png|jpe?g|webp|gif|svg)$/i, "");
    const fileName = `${today()}_${Date.now()}_${original}${ext}`;
    fs.writeFileSync(path.join(REFERENCE_DIR, fileName), bytes);
    return send(res, 200, { name: fileName, url: `/references/${encodeURIComponent(fileName)}`, type: mime });
  }

  if (url.pathname === "/api/render-local" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const demand = String(body.demand || "");
    const confirmedPrompt = String(body.prompt || makePrompt(demand));
    const references = parseReferences(body.references);
    const scenario = matchScenario(demand);
    const extracted = extractTitles(demand);
    const title = extracted.title || `让${scenario.scene}风险在事故前被看见`;
    const subtitles = extracted.subtitles.length ? extracted.subtitles : [scenario.value, "车机预警、平台推送、实时干预，形成管理闭环。"];
    const stamp = `${today()}_${safeName(scenario.industry)}_${safeName(scenario.scene)}_web_v1`;
    const imageName = `${stamp}.svg`;
    const recordName = `${stamp}_生成记录.md`;
    if (!fs.existsSync(RECORD_DIR)) fs.mkdirSync(RECORD_DIR, { recursive: true });
    const svg = makeSvgPoster({ title, subtitles, scenario });
    fs.writeFileSync(path.join(RECORD_DIR, imageName), svg, "utf8");
    const referenceRecord = references.length ? references.map((item, index) => `${index + 1}. ${item.name} - ${item.url}`).join("\n") : "无";
    fs.writeFileSync(path.join(RECORD_DIR, recordName), `# ${stamp}_生成记录\n\n## 用户需求\n\n${demand}\n\n## 匹配场景\n\n${scenario.industry} / ${scenario.scene}\n\n## 参考图\n\n${referenceRecord}\n\n## 已确认 Prompt\n\n${confirmedPrompt}\n`, "utf8");
    return send(res, 200, { ok: true, image: `/records/${encodeURIComponent(imageName)}`, name: imageName });
  }

  return send(res, 404, { error: "unknown api" });
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function wrap(text, max = 26) {
  const out = [];
  let line = "";
  for (const ch of String(text || "")) {
    line += ch;
    if (line.length >= max || /[，。；！]/.test(ch)) {
      out.push(line);
      line = "";
    }
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

function makeSvgPoster({ title, subtitles, scenario }) {
  const titleLines = wrap(title, 16).slice(0, 2);
  const subLines = subtitles.flatMap((s) => wrap(s, 32)).slice(0, 4);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07080d"/>
      <stop offset="0.45" stop-color="#120827"/>
      <stop offset="1" stop-color="#081f24"/>
    </linearGradient>
    <radialGradient id="cyan" cx="75%" cy="15%" r="50%">
      <stop offset="0" stop-color="#03cdb8" stop-opacity=".72"/>
      <stop offset="1" stop-color="#03cdb8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="purple" cx="10%" cy="25%" r="55%">
      <stop offset="0" stop-color="#4e0ea5" stop-opacity=".7"/>
      <stop offset="1" stop-color="#4e0ea5" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#bg)"/>
  <rect width="1200" height="1500" fill="url(#cyan)"/>
  <rect width="1200" height="1500" fill="url(#purple)"/>
  <rect x="24" y="24" width="1152" height="1452" rx="34" fill="none" stroke="#03cdb8" stroke-width="2"/>
  <g transform="translate(72 58)">
    <rect width="250" height="54" rx="27" fill="#0b1220" stroke="#03cdb8" stroke-width="2"/>
    <text x="28" y="36" font-family="Arial, sans-serif" font-size="24" fill="#eafffb">G7 易流</text>
  </g>
  ${titleLines.map((line, i) => `<text x="72" y="${178 + i * 76}" font-family="PingFang SC, Hiragino Sans GB, sans-serif" font-size="66" font-weight="700" fill="#fff">${esc(line)}</text>`).join("")}
  <rect x="72" y="286" width="1056" height="210" rx="28" fill="#f8fafc" stroke="#03cdb8" stroke-width="3"/>
  <rect x="72" y="286" width="14" height="210" fill="#03cdb8"/>
  ${subLines.map((line, i) => `<text x="112" y="${348 + i * 42}" font-family="PingFang SC, Hiragino Sans GB, sans-serif" font-size="30" fill="#17212b">${esc(line)}</text>`).join("")}
  <g transform="translate(140 590)">
    <path d="M0 300 C200 120 520 110 750 270" fill="none" stroke="#ff6b4a" stroke-width="18" opacity=".9"/>
    <path d="M80 330 C250 170 505 165 690 292" fill="none" stroke="#ff6b4a" stroke-width="10" opacity=".7"/>
    <rect x="120" y="175" width="620" height="250" rx="24" fill="#e8edf2" stroke="#fff" stroke-width="4"/>
    <rect x="155" y="210" width="555" height="180" rx="20" fill="#4b5563" stroke="#03cdb8" stroke-width="4"/>
    <polygon points="735,250 930,300 985,410 780,430" fill="#dce3ea"/>
    <rect x="190" y="252" width="470" height="110" rx="16" fill="none" stroke="#ff6b4a" stroke-width="7"/>
    ${Array.from({ length: 10 }).map((_, i) => `<ellipse cx="${230 + (i % 5) * 86}" cy="${288 + Math.floor(i / 5) * 52}" rx="44" ry="22" fill="#eab0a4"/><circle cx="${260 + (i % 5) * 86}" cy="${284 + Math.floor(i / 5) * 52}" r="4" fill="#3b2525"/>`).join("")}
    <circle cx="220" cy="420" r="58" fill="#05070a" stroke="#68717d" stroke-width="4"/>
    <circle cx="660" cy="420" r="58" fill="#05070a" stroke="#68717d" stroke-width="4"/>
    <circle cx="880" cy="420" r="58" fill="#05070a" stroke="#68717d" stroke-width="4"/>
    <text x="170" y="145" font-family="Arial, sans-serif" font-size="28" fill="#ff6b4a">急刹 / 急转风险</text>
  </g>
  <g transform="translate(770 620)">
    <rect width="350" height="300" rx="28" fill="#0b1220" stroke="#03cdb8" stroke-width="3"/>
    <text x="32" y="58" font-family="Arial, sans-serif" font-size="28" fill="#fff">AI 驾驶行为监测</text>
    <line x1="32" y1="84" x2="318" y2="84" stroke="#4e0ea5" stroke-width="4"/>
    ${["急刹报警 HIGH", "急转弯报警 触发", "平台同步 已推送", "干预建议 平稳驾驶"].map((line, i) => `<rect x="32" y="${110 + i * 48}" width="286" height="34" rx="14" fill="#f8fafc"/><circle cx="52" cy="${127 + i * 48}" r="8" fill="${i === 0 ? "#ff6b4a" : i === 1 ? "#ffd166" : "#03cdb8"}"/><text x="72" y="${136 + i * 48}" font-family="PingFang SC, sans-serif" font-size="18" fill="#111827">${esc(line)}</text>`).join("")}
  </g>
  <rect x="72" y="1190" width="1056" height="172" rx="30" fill="#f8fafc"/>
  ${[["实时识别", "急刹 / 急转 / 风险入弯"], ["即时预警", "车机屏 + 平台同步提醒"], ["降低损耗", "减少堆叠踩踏与运输风险"]].map((item, i) => `<g transform="translate(${112 + i * 345} 1232)"><rect width="280" height="96" rx="20" fill="#03cdb8"/><text x="24" y="38" font-family="PingFang SC, sans-serif" font-size="30" font-weight="700" fill="#fff">${item[0]}</text><text x="24" y="72" font-family="PingFang SC, sans-serif" font-size="18" fill="#eafffb">${item[1]}</text></g>`).join("")}
  <text x="72" y="1432" font-family="PingFang SC, sans-serif" font-size="26" fill="#e5e7eb">紫宝盒 AI 主动治理 | 聪明看见 · 有效沟通</text>
  <text x="900" y="1432" font-family="Arial, sans-serif" font-size="20" fill="#8a94a3">B2B 方案海报示意</text>
</svg>`;
}

http.createServer((req, res) => {
  if (req.url.startsWith("/api") || req.url.startsWith("/records") || req.url.startsWith("/references")) {
    handleApi(req, res).catch((err) => send(res, 500, { error: err.message }));
    return;
  }
  serveStatic(req, res);
}).listen(PORT, HOST, () => {
  console.log(`Poster web app running at http://${HOST}:${PORT}`);
});
