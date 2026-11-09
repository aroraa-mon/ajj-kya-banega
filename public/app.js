const T = {
  hinglish: {
    title: "Aaj Kya Banega?", subtitle: "Nashta: ek jawab, koi bahas nahi",
    who: "Aap kaun?", pick: "Select karein",
    today: "Aaj ka nashta", tomorrow: "Kal ka nashta",
    surprise: "Surprise! 🎁", surpriseHidden: "Kal ke liye ek surprise hai. Kal subah pata chalega.",
    secret: "Sirf cook ko dikh raha hai. Surprise mat bataiye!",
    voteHint: "Vote karein. Sabse zyada vote wala banega, barabari par app ka pick.",
    closes: "Vote 11:59 PM tak", closed: "Vote band ho gaya",
    votes: (n) => `${n} vote`, pickTag: "App ka pick", yourVote: "Aapka vote",
    reroll: "Aaj nahi ban sakta", rerollTomorrow: "Kal nahi ban sakta",
    reasons: { votes: "Vote se tay hua", default: "App ka pick", "cook-reroll": "Cook ne badla" },
    why: { protein: "Protein", winter: "Sardi special", weekend: "Weekend", easy: "Aasaan", light: "Halka", treat: "Treat" },
    protein: { High: "Zyada protein", Medium: "Medium protein", Low: "Kam protein" },
    voted: "Vote ho gaya", who_first: "Pehle apna naam chuniye",
    pinPh: "PIN", pinAgainPh: "PIN dobara",
    enter: "Aage badho", pinSet: "PIN set karein",
    pinHint: "Apna PIN daaliye.", pinSetHint: "4 digit ka PIN set karein. Dono baar same likhiye.",
    remembered: "Yeh phone pehle se yaad hai.",
    pinShort: "PIN 4 digit ka hona chahiye", pinMismatch: "Dono PIN same hone chahiye",
    pinNeed: "Pehle apna PIN daaliye",
    confirm: "Pakka? Ek hi baar badal sakte hain.",
    tally: (v, t) => `${v} / ${t} ne vote kiya`, loading: "Load ho raha hai...",
  },
  hi: {
    title: "आज क्या बनेगा?", subtitle: "नाश्ता: एक जवाब, कोई बहस नहीं",
    who: "आप कौन?", pick: "चुनें",
    today: "आज का नाश्ता", tomorrow: "कल का नाश्ता",
    surprise: "सरप्राइज़! 🎁", surpriseHidden: "कल के लिए एक सरप्राइज़ है। कल सुबह पता चलेगा।",
    secret: "सिर्फ़ कुक को दिख रहा है। सरप्राइज़ मत बताइए!",
    voteHint: "वोट करें। सबसे ज़्यादा वोट वाला बनेगा, बराबरी पर ऐप का चुनाव।",
    closes: "वोट रात 11:59 तक", closed: "वोट बंद हो गया",
    votes: (n) => `${n} वोट`, pickTag: "ऐप का चुनाव", yourVote: "आपका वोट",
    reroll: "आज नहीं बन सकता", rerollTomorrow: "कल नहीं बन सकता",
    reasons: { votes: "वोट से तय हुआ", default: "ऐप का चुनाव", "cook-reroll": "कुक ने बदला" },
    why: { protein: "प्रोटीन", winter: "सर्दी स्पेशल", weekend: "वीकेंड", easy: "आसान", light: "हल्का", treat: "ट्रीट" },
    protein: { High: "ज़्यादा प्रोटीन", Medium: "मध्यम प्रोटीन", Low: "कम प्रोटीन" },
    voted: "वोट हो गया", who_first: "पहले अपना नाम चुनिए",
    pinPh: "पिन", pinAgainPh: "पिन दोबारा",
    enter: "आगे बढ़ो", pinSet: "पिन सेट करें",
    pinHint: "अपना पिन डालिए।", pinSetHint: "4 अंक का पिन सेट करें। दोनों बार एक जैसा।",
    remembered: "यह फ़ोन पहले से याद है।",
    pinShort: "पिन 4 अंक का होना चाहिए", pinMismatch: "दोनों पिन एक जैसे होने चाहिए",
    pinNeed: "पहले अपना पिन डालिए",
    confirm: "पक्का?", tally: (v, t) => `${v} / ${t} ने वोट किया`, loading: "लोड हो रहा है...",
  },
  en: {
    title: "What's for breakfast?", subtitle: "One answer, no debate",
    who: "Who are you?", pick: "Select",
    today: "Today's breakfast", tomorrow: "Tomorrow's breakfast",
    surprise: "Surprise! 🎁", surpriseHidden: "There's a surprise tomorrow. You'll find out in the morning.",
    secret: "Only cooks can see this. Keep it a secret!",
    voteHint: "Cast your vote. Most votes wins; a tie keeps the app's pick.",
    closes: "Voting closes 11:59 PM", closed: "Voting closed",
    votes: (n) => `${n} vote${n === 1 ? "" : "s"}`, pickTag: "App's pick", yourVote: "Your vote",
    reroll: "Can't make this today", rerollTomorrow: "Can't make this tomorrow",
    reasons: { votes: "Decided by votes", default: "App's pick", "cook-reroll": "Swapped by the cook" },
    why: { protein: "Protein", winter: "Winter special", weekend: "Weekend", easy: "Easy", light: "Light", treat: "Treat" },
    protein: { High: "High protein", Medium: "Medium protein", Low: "Low protein" },
    voted: "Vote saved", who_first: "Pick your name first",
    pinPh: "PIN", pinAgainPh: "PIN again",
    enter: "Continue", pinSet: "Set PIN",
    pinHint: "Enter your PIN.", pinSetHint: "Choose a 4-digit PIN. Type it twice.",
    remembered: "This phone is already remembered.",
    pinShort: "PIN must be 4 digits", pinMismatch: "The two PINs don't match",
    pinNeed: "Enter your PIN first",
    confirm: "Sure?", tally: (v, t) => `${v} of ${t} voted`, loading: "Loading...",
  },
};

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function savedTokens() {
  try {
    const parsed = JSON.parse(store.get("tokens", "{}"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* private mode or bad json */ }
  return {};
}
function tokenFor(id) { return savedTokens()[id] ?? ""; }
function saveToken(id, token) {
  const all = savedTokens();
  all[id] = token;
  store.set("tokens", JSON.stringify(all));
}
function clearToken(id) {
  const all = savedTokens();
  delete all[id];
  store.set("tokens", JSON.stringify(all));
}
function signedIn() {
  return !!member && !!tokenFor(member);
}
function selectedMember() {
  return data?.members.find((m) => m.id === member) ?? null;
}
function digitsOnly(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 4);
}
let lang = store.get("lang", "hinglish");
let member = store.get("member", "");
let data = null;

const t = () => T[lang];
const nameOf = (d) => d.name[lang];
const altOf = (d) => (lang === "hi" ? d.name.hinglish : d.name.hi);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function say(text, err = false) {
  const el = $("msg");
  el.textContent = text;
  el.className = "msg" + (err ? " err" : "");
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3500);
}

function chips(d) {
  const why = d.why.filter((k) => k !== "protein").map((k) => `<span class="chip">${esc(t().why[k])}</span>`);
  return `<div class="chips"><span class="chip green">${esc(t().protein[d.protein])}</span>${why.join("")}</div>`;
}

function renderToday(v) {
  const el = $("today");
  let body = "";
  if (v.dish) {
    body = `<h2 class="dish">${esc(nameOf(v.dish))}</h2><p class="alt">${esc(altOf(v.dish))}</p>${chips(v.dish)}
      <p class="status">${esc(t().reasons[v.finalReason] ?? "")}</p>`;
  }
  el.innerHTML = `<p class="eyebrow">${esc(t().today)}</p>${body}${rerollButton(v)}`;
  bindReroll(el, v);
}

function rerollButton(v, tomorrow = false) {
  if (!v.canReroll) return "";
  const label = tomorrow ? t().rerollTomorrow : t().reroll;
  return `<div class="actions"><button class="ghost" data-reroll="${v.date}">${esc(label)}</button></div>`;
}

function bindReroll(el, v) {
  const b = el.querySelector("[data-reroll]");
  if (b) b.onclick = () => act("/api/reroll", { member, date: v.date });
}

function renderTomorrow(v) {
  const el = $("tomorrow");
  const head = `<p class="eyebrow">${esc(t().tomorrow)}</p>`;
  if (v.masked) {
    el.innerHTML = `${head}<h2 class="dish surprise">${esc(t().surprise)}</h2><p class="status">${esc(t().surpriseHidden)}</p>`;
    return;
  }
  if (v.surprise) {
    el.innerHTML = `${head}<h2 class="dish">${esc(nameOf(v.dish))}</h2><p class="alt">${esc(altOf(v.dish))}</p>
      <p class="status">🤫 ${esc(t().secret)}</p>${rerollButton(v, true)}`;
    bindReroll(el, v);
    return;
  }
  const status = v.votingOpen ? t().closes : t().closed;
  const opts = v.options.map((o) => {
    const mine = v.myVote === o.id;
    const lead = o.id === v.leadingId && v.totalVotes > 0;
    const voters = [
      mine ? `<strong>${esc(t().yourVote)}</strong>` : "",
      esc(o.voters.join(", ")),
    ].filter(Boolean).join(" ");
    return `<button class="opt" data-opt="${esc(o.id)}" aria-pressed="${mine}" ${v.votingOpen ? "" : "disabled"}>
      <div class="top"><span class="n">${esc(nameOf(o))}${o.isDefault ? ` <span class="tag">${esc(t().pickTag)}</span>` : ""}</span><span class="count">${esc(t().votes(o.votes))}${lead ? " ✓" : ""}</span></div>
      ${voters ? `<div class="voters">${voters}</div>` : ""}
    </button>`;
  }).join("");
  el.innerHTML = `${head}
    ${v.votingOpen ? `<p class="status" style="margin-top:0">${esc(t().voteHint)}</p>` : `<h2 class="dish">${esc(nameOf(v.dish))}</h2><p class="alt">${esc(t().reasons[v.finalReason] ?? "")}</p>`}
    <div class="options">${opts}</div>
    <p class="status">${esc(status)} · ${esc(t().tally(v.totalVotes, v.membersTotal))}</p>
    ${rerollButton(v, true)}`;
  el.querySelectorAll("[data-opt]").forEach((b) => {
    b.onclick = () => member ? act("/api/vote", { member, date: v.date, dishId: b.dataset.opt }, t().voted) : say(t().who_first, true);
  });
  bindReroll(el, v);
}

function renderGate() {
  const me = selectedMember();
  const remembered = !!member && !!tokenFor(member);
  const setting = !!me && !me.hasPin && !remembered;
  $("whoLabel").textContent = t().who;
  $("pin").hidden = remembered;
  $("pinAgain").hidden = !setting;
  $("pin").placeholder = t().pinPh;
  $("pinAgain").placeholder = t().pinAgainPh;
  $("pinGo").textContent = setting ? t().pinSet : t().enter;
  if (!member) $("gateHint").textContent = "";
  else if (remembered) $("gateHint").textContent = t().remembered;
  else if (setting) $("gateHint").textContent = t().pinSetHint;
  else $("gateHint").textContent = t().pinHint;
}

function render() {
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
  document.title = t().title;
  $("title").textContent = t().title;
  $("subtitle").textContent = t().subtitle;
  document.querySelectorAll("#lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  const sel = $("member");
  if (data) {
    sel.innerHTML = `<option value="">${esc(t().pick)}</option>` + data.members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}${m.isCook ? " 👩‍🍳" : ""}</option>`).join("");
    sel.value = member;
  }
  renderGate();
  const inside = signedIn() && !!data;
  $("whoName").hidden = !inside;
  $("gate").hidden = inside;
  $("board").hidden = !inside;
  if (!inside) return;
  $("whoName").textContent = selectedMember()?.name ?? "";
  renderToday(data.today);
  renderTomorrow(data.tomorrow);
}

async function load() {
  try {
    const r = await fetch(`/api/home?member=${encodeURIComponent(member)}`);
    const type = r.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) {
      say("Server API missing — redeploy?", true);
      return;
    }
    data = await r.json();
    if (!r.ok) {
      say(data.error ?? "Could not load", true);
      return;
    }
    render();
  } catch { say("Offline?", true); }
}

async function act(url, body, okMsg) {
  const token = tokenFor(body.member);
  if (!token) { say(t().pinNeed, true); render(); return; }
  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token }),
    });
  } catch { say("Offline?", true); return; }
  const j = await r.json();
  if (r.status === 401) clearToken(body.member);
  if (!r.ok) say(j.error, true); else if (okMsg) say(okMsg);
  await load();
}

async function enterWithPin(pin, setting) {
  let r;
  try {
    r = await fetch(setting ? "/api/pin" : "/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member, pin }),
    });
  } catch { say("Offline?", true); return; }
  const j = await r.json();
  if (!r.ok) { say(j.error, true); return; }
  saveToken(member, j.token);
  $("pin").value = "";
  $("pinAgain").value = "";
  await load();
}

document.querySelectorAll("#lang button").forEach((b) => {
  b.onclick = () => { lang = b.dataset.lang; store.set("lang", lang); render(); };
});
$("member").onchange = (e) => { member = e.target.value; store.set("member", member); $("pin").value = ""; $("pinAgain").value = ""; render(); };
$("pin").oninput = () => digitsOnly($("pin"));
$("pinAgain").oninput = () => digitsOnly($("pinAgain"));
$("pinForm").onsubmit = (e) => {
  e.preventDefault();
  if (!member) { say(t().who_first, true); return; }
  if (tokenFor(member)) { render(); return; }
  const me = selectedMember();
  const setting = me ? !me.hasPin : false;
  const pin = $("pin").value.trim();
  if (pin.length !== 4) { say(t().pinShort, true); return; }
  if (setting && pin !== $("pinAgain").value.trim()) { say(t().pinMismatch, true); return; }
  enterWithPin(pin, setting);
};
$("whoName").onclick = () => {
  member = "";
  store.set("member", "");
  $("pin").value = "";
  $("pinAgain").value = "";
  render();
};

render();
load();
setInterval(load, 30000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* not https, or private mode */ });
  });
}
