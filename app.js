const STORAGE_KEY = "internship-tracker-v1";

const defaults = {
  goalHours: 320,
  startDate: "2026-06-15",
  plannedHours: 8,
  dutyWeekdays: [1, 2, 3, 4, 5],
  offDays: ["2026-06-22", "2026-06-23"],
  entries: {},
};

const state = loadState();
let selectedDate = state.startDate;
let visibleMonth = state.startDate.slice(0, 7);

const els = {
  paceLabel: document.querySelector("#paceLabel"),
  finishHeadline: document.querySelector("#finishHeadline"),
  finishDetail: document.querySelector("#finishDetail"),
  progressCircle: document.querySelector("#progressCircle"),
  progressPercent: document.querySelector("#progressPercent"),
  progressHours: document.querySelector("#progressHours"),
  loggedHours: document.querySelector("#loggedHours"),
  remainingHours: document.querySelector("#remainingHours"),
  dutyDays: document.querySelector("#dutyDays"),
  averageHours: document.querySelector("#averageHours"),
  selectedDateInput: document.querySelector("#selectedDateInput"),
  customHoursInput: document.querySelector("#customHoursInput"),
  saveCustomBtn: document.querySelector("#saveCustomBtn"),
  offDayToggle: document.querySelector("#offDayToggle"),
  goalInput: document.querySelector("#goalInput"),
  startInput: document.querySelector("#startInput"),
  plannedHoursInput: document.querySelector("#plannedHoursInput"),
  offDayList: document.querySelector("#offDayList"),
  clearOffDaysBtn: document.querySelector("#clearOffDaysBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  prevMonthBtn: document.querySelector("#prevMonthBtn"),
  nextMonthBtn: document.querySelector("#nextMonthBtn"),
  todayBtn: document.querySelector("#todayBtn"),
  calendarGrid: document.querySelector("#calendarGrid"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaults);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaults),
      ...parsed,
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
      offDays: Array.isArray(parsed.offDays) ? parsed.offDays : defaults.offDays,
      dutyWeekdays: Array.isArray(parsed.dutyWeekdays) ? parsed.dutyWeekdays : defaults.dutyWeekdays,
    };
  } catch {
    return structuredClone(defaults);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value, amount) {
  const date = typeof value === "string" ? parseDate(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function monthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function prettyDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDate(value));
}

function prettyDay(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDate(value));
}

function hoursLabel(value) {
  const rounded = Number(value.toFixed(2));
  return `${rounded}h`;
}

function isDutyDate(value) {
  const date = parseDate(value);
  return state.dutyWeekdays.includes(date.getDay()) && !state.offDays.includes(value);
}

function setEntry(dateValue, hours) {
  const nextHours = Number(hours);
  if (!Number.isFinite(nextHours) || nextHours <= 0) {
    delete state.entries[dateValue];
  } else {
    state.entries[dateValue] = Number(nextHours.toFixed(2));
  }
  saveState();
  render();
}

function setOffDay(dateValue, shouldBeOff) {
  const next = new Set(state.offDays);
  if (shouldBeOff) {
    next.add(dateValue);
    delete state.entries[dateValue];
  } else {
    next.delete(dateValue);
  }
  state.offDays = [...next].sort();
  saveState();
  render();
}

function totals() {
  const entryDates = Object.keys(state.entries).sort();
  const logged = entryDates.reduce((sum, date) => sum + Number(state.entries[date] || 0), 0);
  const dutyLogged = entryDates.filter((date) => Number(state.entries[date]) > 0).length;
  const average = dutyLogged ? logged / dutyLogged : 0;
  const remaining = Math.max(0, Number(state.goalHours) - logged);
  return { entryDates, logged, dutyLogged, average, remaining };
}

function completionFromEntries(entryDates) {
  let running = 0;
  for (const date of entryDates) {
    running += Number(state.entries[date] || 0);
    if (running >= state.goalHours) return date;
  }
  return null;
}

function estimateFinish() {
  const summary = totals();
  const completedOn = completionFromEntries(summary.entryDates);
  if (completedOn) {
    return {
      ...summary,
      finishDate: completedOn,
      projectedDays: 0,
      status: "complete",
    };
  }

  const planned = Number(state.plannedHours) || 8;
  const today = formatDate(new Date());
  let cursor = parseDate(today > state.startDate ? today : state.startDate);
  let running = summary.logged;
  let projectedDays = 0;

  for (let guard = 0; guard < 1500; guard += 1) {
    const key = formatDate(cursor);
    if (!state.entries[key] && isDutyDate(key)) {
      running += planned;
      projectedDays += 1;
      if (running >= state.goalHours) {
        return {
          ...summary,
          finishDate: key,
          projectedDays,
          status: summary.logged ? "forecast" : "empty",
        };
      }
    }
    cursor = addDays(cursor, 1);
  }

  return {
    ...summary,
    finishDate: null,
    projectedDays,
    status: "blocked",
  };
}

function renderSummary() {
  const estimate = estimateFinish();
  const percent = Math.min(100, Math.round((estimate.logged / state.goalHours) * 100));
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (percent / 100) * circumference;

  els.progressCircle.style.strokeDashoffset = String(offset);
  els.progressPercent.textContent = `${percent}%`;
  els.progressHours.textContent = `${hoursLabel(estimate.logged)} / ${hoursLabel(Number(state.goalHours))}`;
  els.loggedHours.textContent = hoursLabel(estimate.logged);
  els.remainingHours.textContent = hoursLabel(estimate.remaining);
  els.dutyDays.textContent = String(estimate.dutyLogged);
  els.averageHours.textContent = hoursLabel(estimate.average);

  if (estimate.status === "complete") {
    els.paceLabel.textContent = "Complete";
    els.finishHeadline.textContent = `Finished on ${prettyDate(estimate.finishDate)}`;
    els.finishDetail.textContent = `${hoursLabel(estimate.logged)} logged against a ${hoursLabel(Number(state.goalHours))} goal.`;
    return;
  }

  if (estimate.finishDate) {
    els.paceLabel.textContent = `${hoursLabel(Number(state.plannedHours) || 8)} forecast`;
    els.finishHeadline.textContent = `Projected finish: ${prettyDate(estimate.finishDate)}`;
    els.finishDetail.textContent = `${hoursLabel(estimate.remaining)} remaining across about ${estimate.projectedDays} duty day${estimate.projectedDays === 1 ? "" : "s"}.`;
    return;
  }

  els.paceLabel.textContent = "Needs schedule";
  els.finishHeadline.textContent = "Finish date pending";
  els.finishDetail.textContent = "Choose at least one duty weekday and forecast hour value.";
}

function renderInputs() {
  els.selectedDateInput.value = selectedDate;
  els.customHoursInput.value = state.entries[selectedDate] ?? "";
  els.offDayToggle.checked = state.offDays.includes(selectedDate);
  els.goalInput.value = state.goalHours;
  els.startInput.value = state.startDate;
  els.plannedHoursInput.value = state.plannedHours;

  document.querySelectorAll("[data-weekday]").forEach((input) => {
    input.checked = state.dutyWeekdays.includes(Number(input.dataset.weekday));
  });
}

function renderOffDays() {
  els.offDayList.replaceChildren();
  if (!state.offDays.length) {
    const empty = document.createElement("span");
    empty.className = "storage-note";
    empty.textContent = "None";
    els.offDayList.append(empty);
    return;
  }

  state.offDays.forEach((date) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = prettyDay(date);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.title = `Remove ${prettyDate(date)}`;
    remove.addEventListener("click", () => setOffDay(date, false));

    tag.append(remove);
    els.offDayList.append(tag);
  });
}

function renderCalendar() {
  els.todayBtn.textContent = monthLabel(visibleMonth);
  els.calendarGrid.replaceChildren();

  const [year, month] = visibleMonth.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const today = formatDate(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const key = formatDate(date);
    const inMonth = date.getMonth() === month - 1;
    const hours = state.entries[key];
    const isOff = state.offDays.includes(key);

    const cell = document.createElement("div");
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `${prettyDate(key)}${hours ? `, ${hoursLabel(Number(hours))}` : isOff ? ", no duty" : ""}`);
    cell.className = [
      "day-cell",
      inMonth ? "" : "outside",
      key === selectedDate ? "selected" : "",
      key === today ? "today" : "",
      isOff ? "off" : "",
      hours ? "done" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cell.addEventListener("click", () => {
      selectedDate = key;
      visibleMonth = key.slice(0, 7);
      render();
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectedDate = key;
      visibleMonth = key.slice(0, 7);
      render();
    });

    const dateRow = document.createElement("div");
    dateRow.className = "date-row";

    const dateNum = document.createElement("span");
    dateNum.className = "date-num";
    dateNum.textContent = String(date.getDate());
    dateRow.append(dateNum);

    const kind = document.createElement("span");
    kind.className = "day-kind";
    kind.textContent = isOff ? "No duty" : isDutyDate(key) ? "Duty" : "";
    dateRow.append(kind);

    const hourText = document.createElement("div");
    hourText.className = "day-hours";
    hourText.textContent = hours ? hoursLabel(Number(hours)) : isOff ? "Off" : "";

    const actions = document.createElement("div");
    actions.className = "mini-actions";
    [4, 8].forEach((preset) => {
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = `${preset}h`;
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedDate = key;
        setOffDay(key, false);
        setEntry(key, preset);
      });
      actions.append(action);
    });

    cell.append(dateRow, hourText, actions);
    els.calendarGrid.append(cell);
  }
}

function render() {
  renderSummary();
  renderInputs();
  renderOffDays();
  renderCalendar();
  if (window.lucide) window.lucide.createIcons();
}

function shiftMonth(amount) {
  const [year, month] = visibleMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  visibleMonth = formatDate(date).slice(0, 7);
  render();
}

document.querySelectorAll("[data-hours]").forEach((button) => {
  button.addEventListener("click", () => {
    setOffDay(selectedDate, false);
    setEntry(selectedDate, Number(button.dataset.hours));
  });
});

els.saveCustomBtn.addEventListener("click", () => {
  setOffDay(selectedDate, false);
  setEntry(selectedDate, Number(els.customHoursInput.value));
});

els.customHoursInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    setOffDay(selectedDate, false);
    setEntry(selectedDate, Number(els.customHoursInput.value));
  }
});

els.selectedDateInput.addEventListener("change", () => {
  selectedDate = els.selectedDateInput.value || selectedDate;
  visibleMonth = selectedDate.slice(0, 7);
  render();
});

els.offDayToggle.addEventListener("change", () => {
  setOffDay(selectedDate, els.offDayToggle.checked);
});

els.goalInput.addEventListener("change", () => {
  state.goalHours = Math.max(1, Number(els.goalInput.value) || defaults.goalHours);
  saveState();
  render();
});

els.startInput.addEventListener("change", () => {
  state.startDate = els.startInput.value || defaults.startDate;
  selectedDate = state.startDate;
  visibleMonth = state.startDate.slice(0, 7);
  saveState();
  render();
});

els.plannedHoursInput.addEventListener("change", () => {
  state.plannedHours = Math.max(0.25, Number(els.plannedHoursInput.value) || defaults.plannedHours);
  saveState();
  render();
});

document.querySelectorAll("[data-weekday]").forEach((input) => {
  input.addEventListener("change", () => {
    const next = new Set(state.dutyWeekdays);
    const weekday = Number(input.dataset.weekday);
    if (input.checked) next.add(weekday);
    else next.delete(weekday);
    state.dutyWeekdays = [...next].sort((a, b) => a - b);
    saveState();
    render();
  });
});

els.clearOffDaysBtn.addEventListener("click", () => {
  state.offDays = [];
  saveState();
  render();
});

els.resetBtn.addEventListener("click", () => {
  if (!confirm("Reset internship tracker data?")) return;
  Object.assign(state, structuredClone(defaults));
  selectedDate = state.startDate;
  visibleMonth = state.startDate.slice(0, 7);
  saveState();
  render();
});

els.prevMonthBtn.addEventListener("click", () => shiftMonth(-1));
els.nextMonthBtn.addEventListener("click", () => shiftMonth(1));
els.todayBtn.addEventListener("click", () => {
  const today = formatDate(new Date());
  selectedDate = today;
  visibleMonth = today.slice(0, 7);
  render();
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `internship-tracker-${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async () => {
  const [file] = els.importInput.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    Object.assign(state, {
      ...structuredClone(defaults),
      ...imported,
      entries: imported.entries && typeof imported.entries === "object" ? imported.entries : {},
      offDays: Array.isArray(imported.offDays) ? imported.offDays : defaults.offDays,
      dutyWeekdays: Array.isArray(imported.dutyWeekdays) ? imported.dutyWeekdays : defaults.dutyWeekdays,
    });
    selectedDate = state.startDate;
    visibleMonth = state.startDate.slice(0, 7);
    saveState();
    render();
  } catch {
    alert("That file could not be imported.");
  } finally {
    els.importInput.value = "";
  }
});

render();
