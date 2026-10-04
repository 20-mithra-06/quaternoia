const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
    );
const md = (s) =>
  esc(s)
    .replace(/```(?:\w+\n)?([\s\S]*?)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/^\s*[-*] (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
function openKey() {
  $("#keyIn").value = localStorage.getItem("gemini_key") || "";
  $("#modelIn").value =
    localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  $("#keyDlg").showModal();
}
$("#keyBtn").onclick = openKey;
$("#keySave").onclick = () => {
  localStorage.setItem("gemini_key", $("#keyIn").value.trim());
  localStorage.setItem(
    "gemini_model",
    $("#modelIn").value.trim() || "gemini-2.5-flash",
  );
  $("#keyDlg").close();
};
/* Real Google Gemini call (free tier via Google AI Studio key) */
async function gemini(prompt, { system, json, history } = {}) {
  const key = localStorage.getItem("gemini_key");
  if (!key) {
    openKey();
    throw new Error(
      "Add your free Gemini API key first (click the key button).",
    );
  }
  const model = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  const body = {
    contents: history || [{ role: "user", parts: [{ text: prompt }] }],
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (json) body.generationConfig = { responseMimeType: "application/json" };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Request failed " + r.status);
  return (d.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
}
const gjson = async (p, o = {}) =>
  JSON.parse(
    (await gemini(p, { ...o, json: true })).replace(/```json|```/g, "").trim(),
  );
let SYS = document.querySelector(".mode.on").dataset.s;
const hist = [],
  log = $("#log");
function add(c, h) {
  const d = document.createElement("div");
  d.className = "msg " + c;
  d.innerHTML = h;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
async function send(t) {
  t = t.trim();
  if (!t) return;
  $("#hero")?.remove();
  add("me", esc(t));
  hist.push({ role: "user", parts: [{ text: t }] });
  const b = add("ai", '<span class="dots"><i></i><i></i><i></i></span>');
  try {
    const r = await gemini(null, { system: SYS, history: hist });
    hist.push({ role: "model", parts: [{ text: r }] });
    let i = 0;
    (function type() {
      i += 4;
      b.innerHTML = md(r.slice(0, i));
      log.scrollTop = log.scrollHeight;
      if (i < r.length) setTimeout(type, 14);
    })();
  } catch (e) {
    hist.pop();
    b.className = "msg ai err";
    b.textContent = e.message;
  }
}
$("#f").onsubmit = (e) => {
  e.preventDefault();
  const v = $("#in").value;
  $("#in").value = "";
  send(v);
};
document
  .querySelectorAll(".chip")
  .forEach((c) => (c.onclick = () => send(c.textContent)));
document.querySelectorAll(".mode").forEach(
  (m) =>
    (m.onclick = () => {
      document
        .querySelectorAll(".mode")
        .forEach((x) => x.classList.remove("on"));
      m.classList.add("on");
      SYS = m.dataset.s;
    }),
);
$("#clear").onclick = () => location.reload();
