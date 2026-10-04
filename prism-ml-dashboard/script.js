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
["0", "1", "2", "3"].forEach(
  (i) =>
    ($("#s" + i).oninput = (e) => ($("#v" + i).textContent = e.target.value)),
);
$("#go").onclick = async () => {
  const v = [0, 1, 2, 3].map((i) => $("#s" + i).value),
    btn = $("#go");
  btn.disabled = true;
  $("#msg").textContent = "Model is thinking...";
  $("#msg").classList.remove("err");
  try {
    const r = await gjson(
      `You are a customer-churn prediction model. Customer: tenure ${v[0]} months, monthly spend $${v[1]}, ${v[2]} support tickets in 90 days, ${v[3]} logins per week. Return ONLY JSON: {"probability":number 0-100,"confidence":number 0-100,"factors":[4 items {"name":"short feature name","impact":number -1 to 1, positive raises churn risk}],"forecast":[6 numbers 0-100, churn risk for next 6 months],"explanation":"2 sentences","action":"one recommended retention action"}`,
    );
    show(r);
    $("#msg").textContent =
      "Done. This is an AI-simulated prediction for demo purposes.";
  } catch (e) {
    $("#msg").textContent = e.message;
    $("#msg").classList.add("err");
  }
  btn.disabled = false;
};
function show(r) {
  const p = Math.round(r.probability);
  $("#pct").textContent = p + "%";
  $("#conf").textContent = Math.round(r.confidence) + "%";
  $("#ring").style.strokeDashoffset = 314 * (1 - p / 100);
  const lvl =
    p > 66
      ? ["High risk", "#ff5d8f"]
      : p > 33
        ? ["Medium risk", "#ffb347"]
        : ["Low risk", "#19e3c4"];
  $("#ring").style.stroke = lvl[1];
  $("#risk").textContent = lvl[0];
  $("#risk").style.color = lvl[1];
  $("#fac").innerHTML = r.factors
    .map(
      (f) =>
        `<div class="f"><span>${esc(f.name)}</span><div class="bar"><i class="${f.impact > 0 ? "up" : "dn"}" data-w="${Math.abs(f.impact) * 50}"></i></div></div>`,
    )
    .join("");
  setTimeout(
    () =>
      document
        .querySelectorAll(".bar i")
        .forEach((i) => (i.style.width = i.dataset.w + "%")),
    50,
  );
  const f = r.forecast,
    W = 600,
    H = 190,
    x = (i) => 40 + (i * (W - 80)) / (f.length - 1),
    y = (v) => H - 30 - (v / 100) * (H - 60);
  $("#fc").innerHTML =
    [0, 50, 100]
      .map(
        (g) =>
          `<line x1="40" x2="560" y1="${y(g)}" y2="${y(g)}"/><text x="8" y="${y(g) + 4}">${g}%</text>`,
      )
      .join("") +
    `<polyline class="ln" points="${f.map((v, i) => x(i) + "," + y(v)).join(" ")}"/>` +
    f
      .map(
        (v, i) =>
          `<circle cx="${x(i)}" cy="${y(v)}" r="4"/><text x="${x(i) - 8}" y="${H - 8}">M+${i + 1}</text>`,
      )
      .join("");
  $("#exp").textContent = r.explanation;
  $("#act").textContent = "Recommended: " + r.action;
}
