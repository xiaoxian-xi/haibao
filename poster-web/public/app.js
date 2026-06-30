const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let uploadedReferences = [];
let pendingFollowup = false;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function switchView(id) {
  $$(".nav").forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === id));
  if (id === "records") loadRecords();
  if (id === "manual") loadManual();
  if (id === "rubric" || id === "design") loadEditor(id);
}

$$(".nav").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderReferencePreview() {
  const box = $("#referencePreview");
  if (!uploadedReferences.length) {
    box.classList.remove("hasItems");
    box.textContent = "尚未上传参考图。";
    return;
  }
  box.classList.add("hasItems");
  box.innerHTML = uploadedReferences.map((item) => `
    <figure>
      <img src="${item.url}" alt="${escapeHtml(item.name)}" />
      <figcaption>${escapeHtml(item.name)}</figcaption>
    </figure>
  `).join("");
}

function renderFollowup(questions = []) {
  pendingFollowup = Boolean(questions.length);
  $("#followupBox").classList.toggle("hidden", !pendingFollowup);
  $("#followupQuestions").innerHTML = questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("");
}

$("#uploadReference").addEventListener("click", async () => {
  const files = [...$("#referenceFiles").files];
  if (!files.length) return alert("请先选择参考图。");
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      alert(`不支持的文件类型：${file.name}`);
      continue;
    }
    const dataUrl = await fileToDataUrl(file);
    const uploaded = await api("/api/upload-reference", {
      method: "POST",
      body: JSON.stringify({ name: file.name, type: file.type, dataUrl }),
    });
    uploadedReferences.push(uploaded);
  }
  $("#referenceFiles").value = "";
  renderReferencePreview();
  $("#analysis").textContent = "参考图已上传。请重新生成完整 Prompt，让参考图清单进入最终生图提示词。";
});

$("#clearReferences").addEventListener("click", () => {
  uploadedReferences = [];
  renderReferencePreview();
  $("#analysis").textContent = "已清空本次参考图。";
});

$("#makePrompt").addEventListener("click", async () => {
  const demand = $("#demand").value.trim();
  if (!demand) return alert("请先输入用户需求。");
  const followupAnswers = $("#followupAnswers").value.trim();
  const data = await api("/api/prompt", {
    method: "POST",
    body: JSON.stringify({ demand, hasReference: Boolean(uploadedReferences.length), references: uploadedReferences, followupAnswers }),
  });
  if (data.requiresFollowup) {
    $("#prompt").value = "";
    renderFollowup(data.questions);
    $("#analysis").textContent = `匹配：${data.scenario.industry} / ${data.scenario.scene}\n需要先回答追问问题，再生成完整 Prompt。\n下一步：${data.nextStep}`;
    return;
  }
  renderFollowup([]);
  $("#prompt").value = data.prompt;
  $("#analysis").textContent = `匹配：${data.scenario.industry} / ${data.scenario.scene}\n下一步：${data.nextStep}`;
});

$("#renderLocal").addEventListener("click", async () => {
  const demand = $("#demand").value.trim();
  if (!demand) return alert("请先输入用户需求。");
  if (pendingFollowup && !$("#prompt").value.trim()) {
    alert("该临时需求需要先回答追问问题，再生成完整 Prompt。");
    return;
  }
  if (!$("#prompt").value.trim()) {
    alert("请先生成完整 Prompt，确认后再生成本地示例海报。");
    return;
  }
  if (!confirm("请确认：当前 Prompt 已确认，无需再上传参考图，现在生成本地示例海报？")) return;
  const data = await api("/api/render-local", {
    method: "POST",
    body: JSON.stringify({ demand, prompt: $("#prompt").value, references: uploadedReferences }),
  });
  $("#analysis").textContent = `已生成：${data.name}\n已保存到 生图记录/`;
  switchView("records");
});

async function loadManual() {
  const data = await api("/api/manual");
  $("#manualContent").textContent = [
    "## 核心 SOP",
    data.sop,
    "## 用户追问规则",
    data.question,
    "## 生图提示词模板",
    data.prompt,
  ].join("\n\n");
}

async function loadRecords() {
  const data = await api("/api/records");
  const grid = $("#recordGrid");
  grid.innerHTML = "";
  if (!data.files.length) {
    grid.textContent = "暂无最终海报图片。";
    return;
  }
  for (const file of data.files) {
    const item = document.createElement("div");
    item.className = "record";
    item.innerHTML = `<img src="${file.url}" alt="${file.name}"><a href="${file.url}" target="_blank">${file.name}</a>`;
    grid.appendChild(item);
  }
}

async function loadEditor(viewId) {
  const section = $(`#${viewId}`);
  const key = section.dataset.file;
  const data = await api(`/api/file/${key}`);
  $(".fileEditor", section).value = data.content;
}

$$(".save").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const section = btn.closest(".editor");
    const key = section.dataset.file;
    await api(`/api/file/${key}`, {
      method: "POST",
      body: JSON.stringify({ content: $(".fileEditor", section).value }),
    });
    alert("已保存。");
  });
});

loadRecords();
renderReferencePreview();
