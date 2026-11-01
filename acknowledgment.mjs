import { TYPES, qualifying, viewFor, visibleCaption } from "./acknowledgment-model.mjs";

const states = Object.fromEntries(TYPES.map(type => [type, false]));
const revisions = Object.fromEntries(TYPES.map(type => [type, 0]));
const nodes = {};
const imageCache = new Map();
let data;
let lastValidEvent = { kind: "run", amount: 5 };

function event() {
  return { kind: document.querySelector('input[name="activity"]:checked').value,
    amount: Number(document.querySelector("#amount").value) };
}

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
  if (valid) lastValidEvent = event();
  const message = document.querySelector("#validation");
  message.hidden = valid;
  message.textContent = event().kind === "workout"
    ? "A qualifying workout is at least 15 minutes. Preview maximum: 99."
    : "A qualifying recorded walk or run is at least 3 km. Preview maximum: 99.";
  document.querySelector("#next-all").disabled = !valid && !TYPES.every(type => states[type]);
  return valid;
}

function makeWatch(type, index) {
  const scene = data.scenes.find(scene => scene.id === type);
  const article = document.createElement("article");
  article.className = "watch-column";
  article.dataset.concept = type;
  article.innerHTML = `
    <div class="concept-heading"><span class="concept-number">0${index + 1}</span><h2>${scene.title}</h2></div>
    <p class="fit-tag">${scene.cast}</p>
    <button class="watch-button" aria-label="${scene.title}: acknowledge"><canvas width="780" height="780"></canvas></button>
    <div class="watch-meta"><span class="day"></span><span class="phase"></span></div>
    <h3 class="scene-title"></h3>
    <div class="watch-actions">
      <button class="icon-button undo" title="Return to original scene" aria-label="Return ${scene.title} to the original scene"><i data-lucide="rotate-ccw"></i></button>
      <button class="beat"></button>
    </div>
    <div class="statistics"><span class="speaker"></span><span>Same scene</span></div>`;
  document.querySelector("#watches").append(article);
  nodes[type] = article;
  article.querySelector(".watch-button").onclick = () => act(type);
  article.querySelector(".beat").onclick = () => act(type);
  article.querySelector(".undo").onclick = () => {
    states[type] = false;
    render(type);
  };
}

function act(type) {
  if (!states[type] && !validate()) return;
  states[type] = !states[type];
  render(type);
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
}

async function render(type) {
  const revision = ++revisions[type];
  const scene = data.scenes.find(scene => scene.id === type);
  const article = nodes[type];
  validate();
  const view = viewFor(scene, states[type], lastValidEvent);
  const button = article.querySelector(".watch-button");
  const next = states[type] ? "Resume scene" : "Acknowledge";
  article.querySelector(".day").textContent = `Panel ${String(scene.day).padStart(2, "0")} / 14`;
  article.querySelector(".phase").textContent = view.phase;
  article.querySelector(".scene-title").textContent = view.title;
  article.querySelector(".beat").textContent = next;
  article.querySelector(".beat").disabled = !states[type] && !qualifying(event());
  article.querySelector(".undo").disabled = !states[type];
  article.querySelector(".speaker").textContent = type === "together" ? "Lyra + Doc" : "Lyra";
  document.querySelector("#next-all span").textContent = TYPES.every(type => states[type])
    ? "Resume scenes" : "Acknowledge";
  validate();
  button.setAttribute("aria-label", `${scene.title}, panel ${scene.day}, ${view.phase}: ${view.caption}. ${next}`);
  button.setAttribute("aria-pressed", String(states[type]));
  button.setAttribute("aria-busy", "true");
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
    canvas.dataset.phase = states[type] ? "acknowledgment" : "story";
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
  const response = await fetch("acknowledgment.json?v=2");
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
      states[type] = false; render(type);
    }
  };
  document.querySelector("#next-all").onclick = () => {
    const next = !TYPES.every(type => states[type]);
    if (next && !validate()) return;
    for (const type of TYPES) { states[type] = next; render(type); }
  };
  window.lucide?.createIcons();
  await Promise.all(TYPES.map(render));
  document.body.dataset.ready = "true";
}

start().catch(error => {
  document.querySelector("#loading").textContent = "The preview could not load. Check your connection and reload.";
  console.error(error);
});
