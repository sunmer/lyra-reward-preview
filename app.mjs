import { TYPES, initialState, qualifying, nextBeat, nextMorning, nextLabel, viewFor, visibleCaption } from "./model.mjs";

const titles = { secret: "A Secret", count: "Shared Count", bonus: "Bonus Scenes" };
const fit = { secret: "Existing trigger · new content", count: "Proposed qualifying-day ledger", bonus: "Proposed milestone + collection" };
const states = Object.fromEntries(TYPES.map(type => [type, initialState()]));
const histories = Object.fromEntries(TYPES.map(type => [type, []]));
const archives = Object.fromEntries(TYPES.map(type => [type, null]));
const revisions = Object.fromEntries(TYPES.map(type => [type, 0]));
const nodes = {};
const imageCache = new Map();
let data;

function event() {
  return { kind: document.querySelector('input[name="activity"]:checked').value,
    amount: Number(document.querySelector("#amount").value) };
}
function pace() { return document.querySelector("#pace").value; }

function loadImage(src) {
  if (!src) return Promise.reject(new Error("This scene has no artwork."));
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => { imageCache.delete(src); reject(new Error(`Artwork could not load: ${src}`)); };
      image.src = src;
    }));
  }
  return imageCache.get(src);
}

function validate() {
  const valid = qualifying(event()) && event().amount <= 99;
  const message = document.querySelector("#validation");
  message.hidden = valid;
  message.textContent = event().kind === "workout"
    ? "A qualifying workout is at least 15 minutes. Preview maximum: 99."
    : "A qualifying recorded walk or run is at least 3 km. Preview maximum: 99.";
  document.querySelector("#next-all").disabled = !valid;
  return valid;
}

function makeWatch(type, index) {
  const article = document.createElement("article");
  article.className = "watch-column";
  article.dataset.concept = type;
  article.innerHTML = `
    <div class="concept-heading"><span class="concept-number">0${index + 1}</span><h2>${titles[type]}</h2></div>
    <p class="fit-tag">${fit[type]}</p>
    <button class="watch-button" aria-label="${titles[type]}: advance preview"><canvas width="780" height="780"></canvas></button>
    <div class="watch-meta"><span class="day"></span><span class="phase"></span></div>
    <h3 class="scene-title"></h3>
    <div class="watch-actions">
      <button class="icon-button undo" title="Undo last beat" aria-label="Undo last beat in ${titles[type]}"><i data-lucide="undo-2"></i></button>
      <button class="beat"></button>
      <button class="icon-button skip" title="Next morning without another reward" aria-label="Next morning without another reward in ${titles[type]}"><i data-lucide="sunrise"></i></button>
    </div>
    <div class="statistics"><span class="earned"></span><span class="detail"></span></div>
    <div class="collection"></div>`;
  document.querySelector("#watches").append(article);
  nodes[type] = article;
  article.querySelector(".watch-button").onclick = () => act(type);
  article.querySelector(".beat").onclick = () => act(type);
  article.querySelector(".undo").onclick = () => {
    if (!histories[type].length) return;
    states[type] = histories[type].pop();
    archives[type] = null;
    render(type);
  };
  article.querySelector(".skip").onclick = () => change(type, nextMorning(states[type]));
}

function change(type, next) {
  if (JSON.stringify(next) === JSON.stringify(states[type])) return;
  histories[type].push(structuredClone(states[type]));
  if (histories[type].length > 100) histories[type].shift();
  states[type] = next;
  archives[type] = null;
  render(type);
}

function act(type) {
  if (archives[type] !== null) {
    archives[type] = null;
    render(type);
    return;
  }
  if (!validate()) return;
  change(type, nextBeat(states[type], event(), pace()));
}

function text(ctx, value, x, y, size, color = "#fafaff", align = "center") {
  ctx.font = `700 ${size}px Watch`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function roundRect(ctx, x, y, w, h, radius, fill, stroke = null) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function icon(ctx, name, x, y, scale = .09) {
  const shape = data.icons[name];
  ctx.fillStyle = "#fafaff";
  for (const polygon of shape.slice(2)) {
    ctx.beginPath();
    for (let i = 1; i < polygon.length; i += 2) {
      const px = x + (polygon[i] - shape[0]) * scale;
      const py = y + polygon[i + 1] * scale;
      if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawHeader(ctx) {
  ctx.lineWidth = 2.5;
  roundRect(ctx, 152, 18, 31, 17, 3, null, "#fafaff");
  ctx.fillStyle = "#fafaff";
  ctx.fillRect(183, 23, 3, 8);
  ctx.fillRect(157, 23, 19, 7);
  text(ctx, "84%", 194, 27, 23, "#fafaff", "left");
  text(ctx, "10:08", 195, 72, 69);
  ctx.font = "700 23px Watch";
  const date = "28 OCT";
  const sep = "  |  ";
  const fields = [["IconCloud", "14°"], ["IconHeart", "62"]];
  const width = ctx.measureText(date).width + fields.reduce((total, [name, value]) =>
    total + ctx.measureText(sep).width + (data.icons[name][1] - data.icons[name][0]) * .09
      + 6 + ctx.measureText(value).width, 0);
  let x = (390 - width) / 2;
  text(ctx, date, x, 113, 23, "#fafaff", "left");
  x += ctx.measureText(date).width;
  for (const [name, value] of fields) {
    text(ctx, sep, x, 113, 23, "#fafaff", "left");
    x += ctx.measureText(sep).width;
    icon(ctx, name, x, 103);
    x += (data.icons[name][1] - data.icons[name][0]) * .09 + 6;
    text(ctx, value, x, 113, 23, "#fafaff", "left");
    x += ctx.measureText(value).width;
  }
}

function drawCaption(ctx, view) {
  let size = 25;
  const caption = visibleCaption(view.caption);
  ctx.font = `700 ${size}px Watch`;
  while (ctx.measureText(caption).width > 237 && size > 15) {
    size -= 1;
    ctx.font = `700 ${size}px Watch`;
  }
  const width = ctx.measureText(caption).width + 28;
  const y = view.captionY * 390;
  ctx.lineWidth = 1.5;
  roundRect(ctx, (390 - width) / 2, y - 21, width, 42, 8, "#0b121f",
    view.voice === "radio" ? "#3fd6b4" : null);
  text(ctx, caption, 195, y, size);
  if (view.progress) {
    const { count, max } = view.progress;
    // A proposed persistent rim tally, deliberately separate from the scene.
    for (let i = 0; i < max; i++) {
      const a = (58 + (64 * i / Math.max(1, max - 1))) * Math.PI / 180;
      const x = 195 + Math.cos(a) * 181;
      const cy = 195 + Math.sin(a) * 181;
      ctx.beginPath();
      ctx.arc(x, cy, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = i < count ? "#c7f0ba" : "#536263";
      ctx.fill();
      ctx.strokeStyle = "#071019";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

async function render(type) {
  const revision = ++revisions[type];
  const state = states[type];
  const article = nodes[type];
  const view = viewFor(type, state, data, archives[type]);
  const button = article.querySelector(".watch-button");
  const next = archives[type] !== null ? "Back to story" : nextLabel(state, event());
  article.querySelector(".day").textContent = `Panel ${String(state.day).padStart(2, "0")} / 14 · Day ${state.calendarDay}`;
  article.querySelector(".phase").textContent = view.phase;
  article.querySelector(".scene-title").textContent = view.title;
  article.querySelector(".beat").textContent = next;
  article.querySelector(".beat").disabled = archives[type] === null && (state.day === 14 || !qualifying(event()));
  article.querySelector(".skip").disabled = state.day === 14;
  article.querySelector(".undo").disabled = histories[type].length === 0;
  article.querySelector(".earned").textContent = `${state.ledger.length} qualifying ${state.ledger.length === 1 ? "day" : "days"}`;
  article.querySelector(".detail").textContent = type === "bonus"
    ? `${state.unlocked.length} / 2 memories`
    : type === "count" ? "No streak reset" : "Optional story texture";
  button.setAttribute("aria-label", `${titles[type]}, panel ${state.day}, ${view.phase}: ${view.caption}. ${next}`);
  button.setAttribute("aria-busy", "true");
  const collection = article.querySelector(".collection");
  collection.replaceChildren();
  if (type === "bonus") {
    for (const bonus of data.bonus) {
      const unlocked = state.unlocked.includes(bonus.at);
      const b = document.createElement("button");
      b.className = `memory-button${archives[type] === bonus.at ? " selected" : ""}`;
      b.disabled = !unlocked;
      b.innerHTML = `<i data-lucide="${unlocked ? "book-open" : "lock-keyhole"}"></i><span></span>`;
      b.querySelector("span").textContent = unlocked ? bonus.name : `${bonus.at} days`;
      b.onclick = () => { archives[type] = archives[type] === bonus.at ? null : bonus.at; render(type); };
      collection.append(b);
    }
  }
  window.lucide?.createIcons();
  try {
    const image = await loadImage(view.art);
    await document.fonts.ready;
    if (revision !== revisions[type]) return;
    const canvas = article.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 390, 390);
    ctx.save();
    ctx.beginPath();
    ctx.arc(195, 195, 195, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, 0, 0, 390, 390);
    drawHeader(ctx);
    drawCaption(ctx, view);
    ctx.restore();
    canvas.dataset.art = view.art;
    canvas.dataset.caption = visibleCaption(view.caption);
    canvas.dataset.phase = state.phase;
  } catch (error) {
    if (revision !== revisions[type]) return;
    const ctx = article.querySelector("canvas").getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = "#102019";
    ctx.fillRect(0, 0, 390, 390);
    text(ctx, "Artwork unavailable", 195, 190, 23);
    article.querySelector(".scene-title").textContent = "Artwork unavailable. Reload to retry.";
    console.error(error);
  } finally {
    if (revision === revisions[type]) button.setAttribute("aria-busy", "false");
  }
}

async function start() {
  const response = await fetch("data.json");
  if (!response.ok) throw new Error("Preview data could not load.");
  data = await response.json();
  await document.fonts.load("700 25px Watch");
  TYPES.forEach(makeWatch);
  document.querySelector("#loading").hidden = true;
  document.querySelector("#watches").hidden = false;
  document.querySelector("#controls").addEventListener("submit", e => e.preventDefault());
  for (const radio of document.querySelectorAll('input[name="activity"]')) {
    radio.addEventListener("change", () => {
      const workout = event().kind === "workout";
      const input = document.querySelector("#amount");
      input.min = workout ? 15 : 3;
      input.value = workout ? 15 : 5;
      document.querySelector("#unit").textContent = workout ? "min" : "km";
      validate();
      TYPES.forEach(render);
    });
  }
  document.querySelector("#amount").addEventListener("input", () => { validate(); TYPES.forEach(render); });
  document.querySelector("#reset").onclick = () => {
    for (const type of TYPES) {
      states[type] = initialState(); histories[type] = []; archives[type] = null; render(type);
    }
  };
  document.querySelector("#next-all").onclick = () => TYPES.forEach(act);
  window.lucide?.createIcons();
  await Promise.all(TYPES.map(render));
  document.body.dataset.ready = "true";
}

start().catch(error => {
  document.querySelector("#loading").textContent = "The preview could not load. Check your connection and reload.";
  console.error(error);
});
