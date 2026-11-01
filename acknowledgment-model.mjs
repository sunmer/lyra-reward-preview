export const TYPES = ["solo", "together", "aside"];

export function qualifying(event) {
  if (!event || event.recorded !== true) return false;
  if (event.kind === "workout") return true;
  if (!Number.isFinite(event.amount) || event.amount > 99) return false;
  if (event.kind === "walk" || event.kind === "run") return event.amount >= 3;
  return false;
}

export function visibleCaption(caption) {
  return caption.length > 16 ? `${caption.slice(0, 13)}...` : caption;
}

export function viewFor(scene, acknowledged, event, variation = 0) {
  const options = scene.compliments[event.kind];
  const index = ((variation % options.length) + options.length) % options.length;
  const caption = event.kind === "workout" ? options[index]
    : options[index].replace("{d}", `${Math.round(event.amount)}K`);
  return {
    art: acknowledged ? scene.ack : scene.story,
    caption: acknowledged ? caption : scene.storyCaption,
    captionY: scene.captionY,
    phase: acknowledged ? "Acknowledgment" : "Story",
    title: scene.sceneTitle,
  };
}
