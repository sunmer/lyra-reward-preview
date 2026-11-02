const $ = selector => document.querySelector(selector);
const cache = new Map();
const revisions = new WeakMap();
const states = new Map();
let data;

function image(src) {
  if (!cache.has(src)) cache.set(src, new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { cache.delete(src); reject(new Error(`Artwork unavailable: ${src}`)); };
    img.src = src;
  }));
  return cache.get(src);
}
function text(ctx, value, x, y, size, align = "center") {
  ctx.font = `700 ${size}px Watch`;
  ctx.fillStyle = "#fafaff";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function icon(ctx, name, x, y) {
  const shape = data.icons[name];
  ctx.fillStyle = "#fafaff";
  for (const polygon of shape.slice(2)) {
    ctx.beginPath();
    for (let i = 1; i < polygon.length; i += 2) {
      const px = x + (polygon[i] - shape[0]) * .09;
      const py = y + polygon[i + 1] * .09;
      if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
function header(ctx) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fafaff";
  ctx.beginPath();
  ctx.roundRect(152, 18, 31, 17, 3);
  ctx.stroke();
  ctx.fillStyle = "#fafaff";
  ctx.fillRect(183, 23, 3, 8);
  ctx.fillRect(157, 23, 19, 7);
  text(ctx, "84%", 194, 27, 23, "left");
  text(ctx, "10:08", 195, 72, 69);
  ctx.font = "700 23px Watch";
  const sep = "  |  ";
  const fields = [["IconCloud", "14\u00b0"], ["IconHeart", "62"]];
  const width = ctx.measureText("28 OCT").width + fields.reduce((sum, [name, value]) =>
    sum + ctx.measureText(sep).width + (data.icons[name][1] - data.icons[name][0]) * .09
      + 6 + ctx.measureText(value).width, 0);
  let x = (390 - width) / 2;
  text(ctx, "28 OCT", x, 113, 23, "left");
  x += ctx.measureText("28 OCT").width;
  for (const [name, value] of fields) {
    text(ctx, sep, x, 113, 23, "left");
    x += ctx.measureText(sep).width;
    icon(ctx, name, x, 103);
    x += (data.icons[name][1] - data.icons[name][0]) * .09 + 6;
    text(ctx, value, x, 113, 23, "left");
    x += ctx.measureText(value).width;
  }
}
function currentCaption(scene, kind) {
  if (kind === "story") return scene.storyCaption;
  const activity = $("#activity").value;
  const variation = Number($("#variation").value);
  return scene.compliments[activity][variation].replace("{d}", `${$("#distance").value}K`);
}
function caption(ctx, value, radio, y, compact = false) {
  let size = compact ? 20 : 25;
  const maxWidth = compact ? 140 : 237;
  const height = compact ? 32 : 42;
  ctx.font = `700 ${size}px Watch`;
  while (ctx.measureText(value).width > maxWidth && size > 15) ctx.font = `700 ${--size}px Watch`;
  const width = ctx.measureText(value).width + (compact ? 20 : 28);
  ctx.fillStyle = "#0b121f";
  ctx.beginPath();
  ctx.roundRect((390 - width) / 2, y - height / 2, width, height, 8);
  ctx.fill();
  if (radio) { ctx.strokeStyle = "#3fd6b4"; ctx.lineWidth = 1.5; ctx.stroke(); }
  text(ctx, value, 195, y, size);
}
async function renderFrame(frame, scene, kind) {
  const revision = (revisions.get(frame) || 0) + 1;
  revisions.set(frame, revision);
  const button = frame.querySelector(".watch-button");
  const canvas = frame.querySelector("canvas");
  const value = currentCaption(scene, kind);
  const src = scene[kind];
  button.setAttribute("aria-busy", "true");
  try {
    const img = await image(src);
    await document.fonts.ready;
    if (revisions.get(frame) !== revision) return;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 390, 390);
    ctx.save();
    ctx.beginPath();
    ctx.arc(195, 195, 195, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, 390, 390);
    if ($("#show-ui").checked) header(ctx);
    if ($("#show-copy").checked) caption(ctx, value, kind === "story" && scene.voice === "radio", scene.captionY * 390, scene.captionCompact);
    ctx.restore();
    canvas.dataset.art = src;
    canvas.dataset.phase = kind;
    canvas.dataset.caption = value;
    button.setAttribute("aria-label", `Panel ${scene.day}, ${kind}: ${value}`);
    button.setAttribute("aria-pressed", String(kind === "ack"));
    frame.querySelector("figcaption").textContent = value;
    frame.querySelector(".frame-label strong").textContent = kind === "story" ? "Story" : "Acknowledgment";
    frame.querySelector(".frame-label span").textContent = kind === "story" ? scene.storySpeaker : scene.ackSpeaker;
    frame.querySelector(".frame-tools a").href = src;
  } finally {
    if (revisions.get(frame) === revision) button.setAttribute("aria-busy", "false");
  }
}
function makeFrame(scene, initial) {
  const frame = document.createElement("figure");
  frame.className = "review-frame";
  frame.dataset.initial = initial;
  frame.innerHTML = `<div class="frame-label"><strong></strong><span></span></div>
    <button class="watch-button"><canvas width="780" height="780"></canvas></button>
    <figcaption></figcaption><div class="frame-tools">
    <a href="${scene[initial]}" download><i data-lucide="download"></i>Artwork</a>
    <button class="icon-button restore" title="Restore paired view" aria-label="Restore paired view"><i data-lucide="rotate-ccw"></i></button></div>`;
  states.set(frame, initial);
  const update = kind => { states.set(frame, kind); renderFrame(frame, scene, kind).catch(fail); };
  frame.querySelector(".watch-button").onclick = () => { if (scene.ack) update(states.get(frame) === "story" ? "ack" : "story"); };
  frame.querySelector(".restore").onclick = () => update(initial);
  frame.querySelector(".restore").disabled = !scene.ack;
  if (!scene.ack) frame.querySelector(".watch-button").disabled = true;
  return frame;
}
function build() {
  for (const scene of data.scenes) {
    const option = new Option(`${String(scene.day).padStart(2, "0")} / ${scene.title}`, scene.day);
    $("#panel").add(option);
    const thumb = document.createElement("button");
    thumb.className = "thumb";
    thumb.type = "button";
    thumb.setAttribute("aria-label", `Panel ${scene.day}: ${scene.title}`);
    thumb.dataset.day = scene.day;
    thumb.innerHTML = `<img src="${scene.thumbnail}" alt=""><span>${String(scene.day).padStart(2, "0")}</span>`;
    thumb.onclick = () => { $("#panel").value = String(scene.day); refresh().catch(fail); };
    $("#filmstrip").append(thumb);
    const section = document.createElement("section");
    section.className = "review-scene";
    section.dataset.day = scene.day;
    const heading = document.createElement("h2");
    heading.textContent = `${String(scene.day).padStart(2, "0")} / ${scene.title}`;
    section.append(heading);
    if (scene.note) {
      const p = document.createElement("p");
      p.className = "scene-note";
      p.textContent = scene.note;
      section.append(p);
    }
    const pair = document.createElement("div");
    pair.className = "review-pair";
    pair.append(makeFrame(scene, "story"));
    if (scene.ack) pair.append(makeFrame(scene, "ack"));
    else {
      const p = document.createElement("p");
      p.className = "final-note";
      p.textContent = "The closing scene.";
      pair.append(p);
    }
    section.append(pair);
    if (scene.ack) {
      const details = document.createElement("details");
      details.className = "copy-lines";
      const summary = document.createElement("summary");
      summary.textContent = "Draft copy / all variations";
      details.append(summary);
      for (const [kind, lines] of Object.entries(scene.compliments)) {
        const p = document.createElement("p");
        p.textContent = `${kind}: ${lines.join(" / ")}`;
        details.append(p);
      }
      section.append(details);
    }
    $("#review-scenes").append(section);
  }
  $("#panel").value = "1";
  window.lucide?.createIcons();
}
async function refresh() {
  const selected = $("#panel").value;
  const distance = $("#distance");
  $("#distance-label").hidden = $("#activity").value === "workout";
  distance.disabled = $("#activity").value === "workout";
  if (!distance.disabled && !distance.checkValidity()) {
    $("#review-error").textContent = "Enter a whole distance from 3 to 99 km.";
    $("#review-error").hidden = false;
    return;
  }
  $("#review-error").hidden = true;
  $("#previous").disabled = selected === "all" || selected === "1";
  $("#next").disabled = selected === "all" || selected === "14";
  document.body.dataset.ready = "false";
  const jobs = [];
  for (const section of document.querySelectorAll(".review-scene")) {
    section.hidden = selected !== "all" && section.dataset.day !== selected;
    if (section.hidden) continue;
    const scene = data.scenes[Number(section.dataset.day) - 1];
    for (const frame of section.querySelectorAll(".review-frame")) jobs.push(renderFrame(frame, scene, states.get(frame)));
  }
  for (const thumb of document.querySelectorAll(".thumb")) thumb.setAttribute("aria-current", String(thumb.dataset.day === selected));
  await Promise.all(jobs);
  $("#review-loading").hidden = true;
  document.body.dataset.ready = "true";
}
function fail(error) {
  $("#review-error").textContent = `The review could not load completely. ${error.message}`;
  $("#review-error").hidden = false;
  console.error(error);
}
try {
  const response = await fetch("full-set.json?v=1");
  if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  data = await response.json();
  build();
  await Promise.all([...$("#filmstrip").querySelectorAll("img")].map(img => img.decode()));
  $("#review-controls").onsubmit = event => event.preventDefault();
  $("#settings-toggle").onclick = () => {
    const settings = $("#review-settings");
    settings.hidden = !settings.hidden;
    $("#settings-toggle").setAttribute("aria-expanded", String(!settings.hidden));
  };
  $("#review-controls").onchange = () => refresh().catch(fail);
  $("#distance").oninput = () => refresh().catch(fail);
  for (const [id, offset] of [["previous", -1], ["next", 1]]) {
    $(`#${id}`).onclick = () => {
      $("#panel").value = String(Number($("#panel").value) + offset);
      refresh().catch(fail);
    };
  }
  await refresh();
} catch (error) { fail(error); }
