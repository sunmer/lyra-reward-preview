export const TYPES = ["secret", "count", "bonus"];
export const DEFAULT_EVENT = Object.freeze({ kind: "run", amount: 5 });

export function initialState() {
  return { day: 1, calendarDay: 1, phase: "story", ledger: [], reward: null, unlocked: [] };
}

export function qualifying(event) {
  if (!event || !Number.isFinite(event.amount)) return false;
  if (event.kind === "walk" || event.kind === "run") return event.amount >= 3;
  return event.kind === "workout" && event.amount >= 15;
}

export function activityPrefix(event) {
  return event.kind === "workout" ? `${Math.floor(event.amount)}m` : `${Math.round(event.amount)}K`;
}

export function visibleCaption(caption) {
  return caption.length > 16 ? `${caption.slice(0, 13)}...` : caption;
}

export function canEarn(state) {
  return state.day < 14 && !state.ledger.some(item => item.calendarDay === state.calendarDay);
}

export function earn(state, event, pace) {
  if (!qualifying(event) || !canEarn(state) || state.phase !== "story") return state;
  const next = structuredClone(state);
  const reward = { day: state.day, calendarDay: state.calendarDay, event: { ...event },
    count: state.ledger.length + 1, pace };
  next.ledger.push(reward);
  next.reward = reward;
  next.phase = "reward";
  if (reward.count === 5 || reward.count === 10) next.unlocked.push(reward.count);
  return next;
}

export function finishReward(state) {
  if (state.phase !== "reward") return state;
  const next = structuredClone(state);
  next.phase = "after";
  // Remember the rule at award time so changing the selector cannot alter an active reward.
  if (state.reward.pace === "current") next.day = Math.min(14, next.day + 1);
  return next;
}

export function nextMorning(state) {
  const next = structuredClone(finishReward(state));
  if (next.day >= 14) return next;
  next.day = Math.min(14, next.day + 1);
  next.calendarDay += 1;
  next.phase = "story";
  next.reward = null;
  return next;
}

export function nextBeat(state, event, pace) {
  if (state.phase === "reward") return finishReward(state);
  if (state.phase === "story" && canEarn(state)) return earn(state, event, pace);
  return nextMorning(state);
}

export function nextLabel(state, event) {
  if (state.phase === "reward") return "After 2 hours";
  if (state.day === 14) return "Story complete";
  if (state.phase === "after") return "Next morning";
  return `Earn with ${event.kind === "workout" ? "workout" : event.kind}`;
}

export function viewFor(type, state, data, archive = null) {
  if (archive !== null) {
    const bonus = data.bonus.find(item => item.at === archive);
    if (type !== "bonus" || !state.unlocked.includes(archive) || !bonus) return null;
    return { art: bonus.art, caption: bonus.title, captionY: .86, voice: null,
      title: bonus.name, phase: "Memory", progress: null };
  }
  const day = data.days[state.day - 1];
  if (state.phase !== "reward") {
    return { art: day.story, caption: day.caption, captionY: day.captionY, voice: day.voice,
      title: day.title, phase: state.day === 14 ? "Final panel" : "Story",
      progress: type === "count" && state.ledger.length ? { count: state.ledger.length, max: 13 } : null };
  }
  const reward = state.reward;
  const source = data.days[reward.day - 1];
  const prefix = activityPrefix(reward.event);
  if (type === "secret") {
    return { art: source.companion, caption: `${prefix}. ${source.secret}`, captionY: .86,
      voice: null, title: source.title, phase: "Private aside · 2h", progress: null };
  }
  if (type === "count") {
    return { art: source.companion, caption: `${prefix}. ${reward.count} earned.`, captionY: .84,
      voice: null, title: source.title, phase: "Shared count · 2h",
      progress: { count: reward.count, max: 13 } };
  }
  const bonus = data.bonus.find(item => item.at === reward.count);
  if (bonus) {
    return { art: bonus.art,
      caption: `${prefix}. ${reward.count === 5 ? "He waited." : "Before us."}`,
      captionY: .86, voice: null, title: bonus.name, phase: "Memory unlocked · 2h",
      progress: null };
  }
  const goal = reward.count < 5 ? 5 : reward.count < 10 ? 10 : null;
  return { art: source.companion, caption: `${prefix}. ${goal ? `${reward.count}/${goal}.` : "All found."}`,
    captionY: .84, voice: null, title: source.title, phase: "Memory progress · 2h",
    progress: { count: Math.min(reward.count, 10), max: 10 } };
}
