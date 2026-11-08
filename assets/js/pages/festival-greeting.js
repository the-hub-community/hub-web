(function initDashboardGreeting() {
  "use strict";

  const titleEl = document.getElementById("ed-greeting-title");
  if (!titleEl) return;

  const eyebrowEl = document.getElementById("ed-greeting-eyebrow");
  const subtitleEl = document.getElementById("ed-greeting-subtitle");
  const celebrationEl = document.querySelector(".community-hero__celebration");
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isoDate = `${now.getFullYear()}-${monthDay}`;
  const scheduleEl = document.getElementById("festival-greeting-schedule");
  let schedule = { fixed: [], annual: [] };

  try {
    if (scheduleEl?.textContent) {
      schedule = JSON.parse(scheduleEl.textContent);
    }
  } catch (error) {
    console.error("Could not read festival greeting schedule.", error);
  }

  const festival =
    schedule.fixed?.find(
      (item) =>
        item.date === monthDay ||
        (item.start <= monthDay && monthDay <= item.end),
    ) || schedule.annual?.find((item) => item.date === isoDate);

  if (festival) {
    titleEl.textContent = festival.title;
    if (eyebrowEl) eyebrowEl.textContent = festival.eyebrow;
    if (subtitleEl) subtitleEl.textContent = festival.subtitle;
    if (celebrationEl) celebrationEl.hidden = false;
    return;
  }

  const hour = now.getHours();
  let greeting = "Good evening.";
  let eyebrow = "Welcome back";

  if (hour >= 5 && hour < 12) {
    greeting = "Good morning.";
    eyebrow = "Fresh start";
  } else if (hour >= 12 && hour < 18) {
    greeting = "Good afternoon.";
    eyebrow = "Mid-day check-in";
  } else if (hour >= 18 && hour < 22) {
    greeting = "Good evening.";
    eyebrow = "Evening roundup";
  } else {
    greeting = "Welcome back.";
    eyebrow = "Late night";
  }

  titleEl.textContent = greeting;
  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
})();
