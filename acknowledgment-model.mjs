export const TYPES = ["solo", "together", "aside"];

export function qualifying(event) {
  if (!event || !Number.isFinite(event.amount) || event.amount > 99) return false;
  if (event.kind === "walk" || event.kind === "run") return event.amount >= 3;
  return event.kind === "workout" && event.amount >= 15;
}

export function activityPrefix(event) {
  return event.kind === "workout" ? `${Math.floor(event.amount)}m` : `${Math.round(event.amount)}K`;
}

export function visibleCaption(caption) {
  return caption.length > 16 ? `${caption.slice(0, 13)}...` : caption;
}

export function viewFor(scene, acknowledged, event) {
  return {
    art: acknowledged ? scene.ack : scene.story,
    caption: acknowledged ? `${activityPrefix(event)}. ${scene.compliments[event.kind]}` : scene.storyCaption,
    captionY: scene.captionY,
    phase: acknowledged ? "Acknowledgment" : "Story",
    title: scene.sceneTitle,
  };
}
