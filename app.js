const STORAGE_KEY = "birthday-tracker-v1";

const RU_LETTERS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

const DEFAULT_PEOPLE = [
  { name: "Анюта", day: 7, month: 8 },
  { name: "Папа Ани Назар", day: 7, month: 8 },
  { name: "Мама Ани", day: 25, month: 5 },
  { name: "Тетя Аня", day: 30, month: 6 },
];

let people = [];
let personName = "";
let personDay = "";
let personMonth = null;
let letterCase = "upper";

const $ = (sel) => document.querySelector(sel);

const els = {
  todayBlock: $("#todayBlock"),
  missedBlock: $("#missedBlock"),
  soonBlock: $("#soonBlock"),
  laterBlock: $("#laterBlock"),
  emptyState: $("#emptyState"),
  nextBdayWidget: $("#nextBdayWidget"),
  addView: $("#addView"),
  namePreview: $("#namePreview"),
  dayDisplay: $("#dayDisplay"),
  letterPad: $("#letterPad"),
  dayNumpad: $("#dayNumpad"),
  monthGrid: $("#monthGrid"),
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      people = JSON.parse(raw);
    } else {
      people = DEFAULT_PEOPLE.map((p) => ({
        id: crypto.randomUUID(),
        name: p.name,
        day: p.day,
        month: p.month,
        congratulatedYear: null,
      }));
      save();
    }
  } catch {
    people = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getNextBirthday(day, month) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < today) next = new Date(year + 1, month - 1, day);
  const daysUntil = Math.round((next - today) / 86400000);
  return { next, daysUntil };
}

function getDaysSinceBirthday(day, month) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const bday = new Date(year, month - 1, day);
  if (bday > today) return null;
  const days = Math.round((today - bday) / 86400000);
  return days === 0 ? null : days;
}

function formatDate(day, month) {
  return `${day} ${MONTHS[month - 1].toLowerCase()}`;
}

function countdownText(p) {
  const { daysUntil, daysSince, congratulatedYear, day, month } = p;
  const year = new Date().getFullYear();
  if (daysUntil === 0) {
    return congratulatedYear === year ? "Поздравил ✓" : "Сегодня!";
  }
  if (daysSince !== null && daysSince <= 14 && congratulatedYear !== year) {
    if (daysSince === 1) return "Вчера был ДР";
    return `${daysSince} дн. назад`;
  }
  if (daysUntil === 1) return "Завтра";
  if (daysUntil <= 30) return `Через ${daysUntil} дн.`;
  return MONTHS_SHORT[month - 1];
}

function enrichPerson(p) {
  const { daysUntil } = getNextBirthday(p.day, p.month);
  const daysSince = getDaysSinceBirthday(p.day, p.month);
  const year = new Date().getFullYear();
  let group = "later";

  if (daysUntil === 0) group = "today";
  else if (daysSince !== null && daysSince <= 14 && p.congratulatedYear !== year) group = "missed";
  else if (daysUntil <= 14) group = "soon";

  return { ...p, daysUntil, daysSince, group };
}

function formatIcsDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}${m}${d}`;
}

function icsEscape(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildICS(person) {
  const year = new Date().getFullYear();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = `ДР ${person.name}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DR Tracker//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${person.id}@dr-tracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(year, person.month, person.day)}`,
    "RRULE:FREQ=YEARLY",
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(`День рождения — ${person.name}. Не забудь поздравить!`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Через неделю ДР у ${person.name}`)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT9H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Сегодня ДР у ${person.name}!`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function openCalendarReminder(person) {
  const ics = buildICS(person);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DR-${person.name.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function renderCard(p) {
  const year = new Date().getFullYear();
  const done = p.congratulatedYear === year && (p.daysUntil === 0 || p.group === "missed");
  const inCal = !!p.calendarAdded;
  const cardClass =
    p.group === "today" ? "person-card person-card--today" :
    p.group === "missed" ? "person-card person-card--missed" : "person-card";

  const showDone = p.daysUntil === 0 || p.group === "missed";

  const calBtn = inCal
    ? `<button class="btn-small btn-small--cal btn-small--cal-done" type="button" data-cal="${p.id}" title="Уже в календаре. Нажми, чтобы открыть снова">📅 ✓</button>`
    : `<button class="btn-small btn-small--cal" type="button" data-cal="${p.id}">📅 В календарь</button>`;

  return `
    <div class="${cardClass}">
      <span class="person-emoji">🎂</span>
      <div class="person-body">
        <div class="person-name">
          ${escapeHtml(p.name)}
          ${inCal ? '<span class="cal-badge">в календаре</span>' : ""}
        </div>
        <div class="person-date">${formatDate(p.day, p.month)}</div>
      </div>
      <div class="person-actions">
        <span class="person-countdown">${countdownText(p)}</span>
        ${calBtn}
        ${inCal ? `<button class="btn-small btn-small--unmark" type="button" data-uncal="${p.id}" title="Снять отметку">↩</button>` : ""}
        ${showDone && !done ? `<button class="btn-small btn-small--done" type="button" data-done="${p.id}">Поздравил ✓</button>` : ""}
        ${done ? `<span class="btn-small btn-small--done" style="border:none;background:none">✓</span>` : ""}
        <button class="btn-small btn-small--delete" type="button" data-del="${p.id}" aria-label="Удалить">×</button>
      </div>
    </div>`;
}

function renderNextWidget(enriched) {
  const el = els.nextBdayWidget;
  if (!el) return;

  if (!people.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const todayList = enriched
    .filter((p) => p.daysUntil === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  if (todayList.length) {
    const p = todayList[0];
    const extra = todayList.length > 1 ? ` +${todayList.length - 1}` : "";
    el.hidden = false;
    el.className = "next-bday next-bday--today";
    el.innerHTML = `
      <span class="next-bday-emoji">🎉</span>
      <div class="next-bday-body">
        <span class="next-bday-label">Сегодня ДР</span>
        <span class="next-bday-name">${escapeHtml(p.name)}${extra ? `<span class="next-bday-extra">${extra}</span>` : ""}</span>
        <span class="next-bday-date">${formatDate(p.day, p.month)}</span>
      </div>
      <span class="next-bday-countdown">Сегодня!</span>`;
    return;
  }

  const upcoming = enriched.filter((p) => p.daysUntil > 0).sort((a, b) => a.daysUntil - b.daysUntil);
  if (!upcoming.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const p = upcoming[0];
  const countdown = p.daysUntil === 1 ? "Завтра" : `Через ${p.daysUntil} дн.`;
  el.hidden = false;
  el.className = "next-bday";
  el.innerHTML = `
    <span class="next-bday-emoji">🎂</span>
    <div class="next-bday-body">
      <span class="next-bday-label">Следующий ДР</span>
      <span class="next-bday-name">${escapeHtml(p.name)}</span>
      <span class="next-bday-date">${formatDate(p.day, p.month)}</span>
    </div>
    <span class="next-bday-countdown">${countdown}</span>`;
}

function renderSection(el, label, labelClass, items) {
  if (!items.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<div class="section-label ${labelClass || ""}">${label}</div>${items.map(renderCard).join("")}`;
}

function render() {
  if (!people.length) {
    els.emptyState.hidden = false;
    els.nextBdayWidget.hidden = true;
    els.nextBdayWidget.innerHTML = "";
    els.todayBlock.hidden = true;
    els.missedBlock.hidden = true;
    els.soonBlock.hidden = true;
    els.laterBlock.hidden = true;
    return;
  }

  els.emptyState.hidden = true;
  const enriched = people.map(enrichPerson);

  renderNextWidget(enriched);

  const today = enriched.filter((p) => p.group === "today").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const missed = enriched.filter((p) => p.group === "missed").sort((a, b) => (a.daysSince || 0) - (b.daysSince || 0));
  const soon = enriched.filter((p) => p.group === "soon").sort((a, b) => a.daysUntil - b.daysUntil);
  const later = enriched.filter((p) => p.group === "later").sort((a, b) => a.daysUntil - b.daysUntil);

  renderSection(els.todayBlock, "🎉 Сегодня", "section-label--today", today);
  renderSection(els.missedBlock, "Недавно был ДР", "section-label--missed", missed);
  renderSection(els.soonBlock, "Скоро", "", soon);
  renderSection(els.laterBlock, "Потом", "", later);

  document.querySelectorAll("[data-done]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = people.find((x) => x.id === btn.dataset.done);
      if (p) {
        p.congratulatedYear = new Date().getFullYear();
        save();
        render();
      }
    });
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      people = people.filter((x) => x.id !== btn.dataset.del);
      save();
      render();
    });
  });

  document.querySelectorAll("[data-cal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = people.find((x) => x.id === btn.dataset.cal);
      if (!p) return;
      openCalendarReminder(p);
      if (!p.calendarAdded) {
        p.calendarAdded = true;
        save();
        render();
      }
    });
  });

  document.querySelectorAll("[data-uncal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = people.find((x) => x.id === btn.dataset.uncal);
      if (p) {
        p.calendarAdded = false;
        save();
        render();
      }
    });
  });
}

function updateNamePreview() {
  const t = personName.trim();
  els.namePreview.textContent = t || "Имя";
  els.namePreview.classList.toggle("is-empty", !t);
}

function updateDayDisplay() {
  els.dayDisplay.textContent = personDay || "—";
  els.dayDisplay.classList.toggle("is-empty", !personDay);
}

function renderLetterPad() {
  const letters = letterCase === "upper" ? RU_LETTERS : RU_LETTERS.map((l) => l.toLowerCase());
  const keys = [
    ...letters.map((l) => ({ key: l, label: l })),
    { key: "space", label: "пробел", wide: true },
    { key: "back", label: "⌫" },
  ];
  els.letterPad.innerHTML = keys
    .map(({ key, label, wide }) => {
      const cls = ["letter-key", wide && "letter-key--wide"].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-key="${key}">${label}</button>`;
    })
    .join("");
  els.letterPad.querySelectorAll(".letter-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      if (key === "back") personName = personName.slice(0, -1);
      else if (key === "space") {
        if (personName && !personName.endsWith(" ")) personName += " ";
      } else if (personName.length < 30) personName += key;
      updateNamePreview();
    });
  });
}

function renderDayNumpad() {
  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0"];
  els.dayNumpad.innerHTML = keys
    .map((k) => `<button type="button" class="num-key${k === "⌫" ? "" : ""}" data-key="${k === "⌫" ? "back" : k}">${k}</button>`)
    .join("");
  els.dayNumpad.querySelectorAll(".num-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.key === "back") {
        personDay = personDay.slice(0, -1);
      } else {
        const next = personDay + btn.dataset.key;
        const n = parseInt(next, 10);
        if (n >= 1 && n <= 31) personDay = String(n);
        else if (n > 31) personDay = "31";
      }
      updateDayDisplay();
    });
  });
}

function renderMonthGrid() {
  els.monthGrid.innerHTML = MONTHS.map((m, i) => {
    const num = i + 1;
    const sel = personMonth === num ? " selected" : "";
    return `<button type="button" class="month-btn${sel}" data-month="${num}">${m.slice(0, 3)}</button>`;
  }).join("");
  els.monthGrid.querySelectorAll(".month-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      personMonth = Number(btn.dataset.month);
      renderMonthGrid();
    });
  });
}

function openAddForm() {
  personName = "";
  personDay = "";
  personMonth = null;
  letterCase = "upper";
  document.querySelectorAll(".case-btn").forEach((b) => {
    b.classList.toggle("case-btn--active", b.dataset.case === "upper");
  });
  updateNamePreview();
  updateDayDisplay();
  renderLetterPad();
  renderDayNumpad();
  renderMonthGrid();
  document.body.classList.add("add-mode");
  els.addView.hidden = false;
  window.scrollTo(0, 0);
}

function closeAddForm() {
  document.body.classList.remove("add-mode");
  els.addView.hidden = true;
}

function savePerson() {
  const name = personName.trim();
  const day = parseInt(personDay, 10);
  if (!name) {
    els.namePreview.style.borderColor = "var(--red)";
    setTimeout(() => { els.namePreview.style.borderColor = ""; }, 600);
    return;
  }
  if (!day || day < 1 || day > 31) {
    els.dayDisplay.style.borderColor = "var(--red)";
    setTimeout(() => { els.dayDisplay.style.borderColor = ""; }, 600);
    return;
  }
  if (!personMonth) return;

  const daysInMonth = new Date(2024, personMonth, 0).getDate();
  const validDay = Math.min(day, daysInMonth);

  people.push({
    id: crypto.randomUUID(),
    name,
    day: validDay,
    month: personMonth,
    congratulatedYear: null,
  });
  save();
  closeAddForm();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

$("#btnAddPerson").addEventListener("click", openAddForm);
$("#btnCloseAdd").addEventListener("click", closeAddForm);
$("#btnSave").addEventListener("click", savePerson);
$("#btnExport").addEventListener("click", exportData);

document.getElementById("caseToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-case]");
  if (!btn) return;
  letterCase = btn.dataset.case;
  document.querySelectorAll(".case-btn").forEach((b) => {
    b.classList.toggle("case-btn--active", b.dataset.case === letterCase);
  });
  renderLetterPad();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

load();
render();
