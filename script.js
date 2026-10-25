const form = document.getElementById('agenda-form');
const agendaPage = document.getElementById('agenda-page');
const pageIndicator = document.getElementById('page-indicator');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const editCurrentTaskBtn = document.getElementById('edit-current-task');
const deleteCurrentTaskBtn = document.getElementById('delete-current-task');
const alertColorInput = document.getElementById('alert-color');
const alarmSoundSelect = document.getElementById('alarm-sound');
const previewAlarmBtn = document.getElementById('preview-alarm');
const manualAlertBtn = document.getElementById('manual-alert-btn');
const dismissAlarmBtn = document.getElementById('dismiss-alarm-btn');
const taskDateInput = document.getElementById('task-date');
const calendarMonth = document.getElementById('calendar-month');
const calendarDays = document.getElementById('calendar-days');
const selectedDateLabel = document.getElementById('selected-date-label');
const calendarPrevBtn = document.getElementById('calendar-prev');
const calendarNextBtn = document.getElementById('calendar-next');
const selectedColorLabel = document.getElementById('selected-color-label');
const colorPresetButtons = document.querySelectorAll('.color-preset');
const taskTimeInput = document.getElementById('task-time');
const taskHourSelect = document.getElementById('task-hour');
const taskMinuteSelect = document.getElementById('task-minute');

function syncTaskTime() {
  const hour = taskHourSelect.value.trim();
  const minute = taskMinuteSelect.value.trim();
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const hourValid = /^\d{1,2}$/.test(hour) && hourValue >= 0 && hourValue <= 23;
  const minuteValid = /^\d{1,2}$/.test(minute) && minuteValue >= 0 && minuteValue <= 59;

  taskHourSelect.setCustomValidity(hour && !hourValid ? 'Informe uma hora entre 00 e 23.' : '');
  taskMinuteSelect.setCustomValidity(minute && !minuteValid ? 'Informe os minutos entre 00 e 59.' : '');
  taskTimeInput.value = hourValid && minuteValid
    ? `${String(hourValue).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')}`
    : '';
}

function normalizeTimePart(input) {
  const value = input.value.trim();
  if (/^\d{1,2}$/.test(value)) input.value = value.padStart(2, '0');
  syncTaskTime();
}

taskHourSelect.addEventListener('input', syncTaskTime);
taskMinuteSelect.addEventListener('input', syncTaskTime);
taskHourSelect.addEventListener('blur', () => normalizeTimePart(taskHourSelect));
taskMinuteSelect.addEventListener('blur', () => normalizeTimePart(taskMinuteSelect));

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
let calendarView = new Date();

let tasks = [
  {
    id: 1,
    title: 'Acordar e arrumar o quarto',
    date: getNextDateForWeekday(1),
    time: '07:30',
    notes: 'Tomar café, escovar os dentes e organizar a mochila.'
  },
  {
    id: 2,
    title: 'Escola',
    date: getNextDateForWeekday(1),
    time: '08:15',
    notes: 'Chegada na escola e organização da rotina da manhã.'
  },
  {
    id: 3,
    title: 'Leitura',
    date: getNextDateForWeekday(3),
    time: '15:00',
    notes: 'Ler 2 histórias com calma e conversar sobre elas.'
  }
];

let editTaskId = null;
let currentPage = 0;
let activeTaskId = null;
let manualAlertTaskId = null;
let manualAlertTimer = null;
let silencedAlarmUntil = 0;
let silencedAlarmTaskId = null;
let alarmAudioContext = null;
let alarmAudioOutput = null;
let alarmLoopTimer = null;

const calmAlarmPatterns = {
  'soft-bells': {
    notes: [523.25, 659.25, 783.99],
    spacing: 0.32,
    duration: 1.7,
    wave: 'sine'
  },
  'warm-chime': {
    notes: [392.0, 493.88, 587.33],
    spacing: 0.38,
    duration: 1.9,
    wave: 'sine'
  },
  'gentle-piano': {
    notes: [261.63, 329.63, 392.0, 523.25],
    spacing: 0.26,
    duration: 1.25,
    wave: 'triangle'
  },
  'calm-wave': {
    notes: [440.0, 493.88, 440.0],
    spacing: 0.52,
    duration: 2.2,
    wave: 'sine'
  }
};

const alertColorNames = {
  '#d93025': 'Vermelho',
  '#ff7a7a': 'Rosa suave',
  '#e7a64c': 'Amarelo dourado',
  '#4f9d92': 'Verde água',
  '#6387d8': 'Azul sereno',
  '#9a72bf': 'Lilás'
};

function normalizeHexColor(value) {
  const safeValue = (value || '#d93025').trim();
  return /^#[0-9a-fA-F]{6}$/.test(safeValue) ? safeValue : '#d93025';
}

function hexToRgb(value) {
  const safeValue = normalizeHexColor(value).replace('#', '');
  const number = Number.parseInt(safeValue, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `${r}, ${g}, ${b}`;
}

function updateAlertColor(themeColor) {
  const normalizedColor = normalizeHexColor(themeColor);
  // The dark theme defines these variables on <body>, so update them there to
  // keep the selected color from being shadowed by the theme defaults.
  document.body.style.setProperty('--alert-color', normalizedColor);
  document.body.style.setProperty('--alert-color-rgb', hexToRgb(normalizedColor));

  if (alertColorInput) {
    alertColorInput.value = normalizedColor;
  }

  colorPresetButtons.forEach((button) => {
    const isSelected = button.dataset.color.toLowerCase() === normalizedColor.toLowerCase();
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });

  if (selectedColorLabel) {
    selectedColorLabel.textContent = `Cor selecionada: ${alertColorNames[normalizedColor.toLowerCase()] || 'Personalizada'}`;
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('incluir-alert-color', normalizedColor);
  }
}

function getCurrentDayName() {
  return weekdayNames[new Date().getDay()];
}

function dateToInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getNextDateForWeekday(weekday) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return dateToInputValue(date);
}

function getTaskDateLabel(task) {
  if (task.date) return fullDateFormatter.format(parseLocalDate(task.date));
  return task.day || '';
}

function updateSelectedDateLabel() {
  if (!taskDateInput?.value || !selectedDateLabel) return;
  selectedDateLabel.textContent = `Selecionado: ${fullDateFormatter.format(parseLocalDate(taskDateInput.value))}`;
}

function renderCalendar() {
  if (!calendarMonth || !calendarDays || !taskDateInput) return;
  const viewYear = calendarView.getFullYear();
  const viewMonth = calendarView.getMonth();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = dateToInputValue(new Date());

  calendarMonth.textContent = monthFormatter.format(calendarView);
  calendarDays.innerHTML = '';

  for (let blank = 0; blank < firstWeekday; blank += 1) {
    const spacer = document.createElement('span');
    spacer.className = 'calendar-empty';
    spacer.setAttribute('aria-hidden', 'true');
    calendarDays.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(viewYear, viewMonth, day);
    const dateValue = dateToInputValue(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(day);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', fullDateFormatter.format(date));
    button.classList.toggle('is-today', dateValue === today);
    button.classList.toggle('is-selected', dateValue === taskDateInput.value);
    button.setAttribute('aria-pressed', String(dateValue === taskDateInput.value));
    button.addEventListener('click', () => {
      taskDateInput.value = dateValue;
      updateSelectedDateLabel();
      renderCalendar();
    });
    calendarDays.appendChild(button);
  }
}

function selectCalendarDate(value) {
  taskDateInput.value = value;
  calendarView = parseLocalDate(value);
  updateSelectedDateLabel();
  renderCalendar();
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function checkActiveTask() {
  const currentDate = dateToInputValue(new Date());
  const currentMinutes = getCurrentMinutes();

  const taskDueNow = tasks.find((task) => {
    if (task.date ? task.date !== currentDate : task.day !== getCurrentDayName()) return false;
    return Math.abs(parseTime(task.time) - currentMinutes) <= 1;
  });

  const silenced = silencedAlarmTaskId && Date.now() < silencedAlarmUntil;
  const dueTaskId = taskDueNow ? taskDueNow.id : null;

  activeTaskId = manualAlertTaskId ?? (silenced ? null : dueTaskId);

  if (activeTaskId !== null) {
    const activeIndex = sortedTasks().findIndex((task) => task.id === activeTaskId);
    if (activeIndex >= 0) {
      currentPage = activeIndex;
    }
  }
}

function parseTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getPeriodLabel(time) {
  const [hours] = time.split(':').map(Number);

  if (hours < 12) return 'Manhã';
  if (hours < 18) return 'Tarde';
  return 'Noite';
}

function sortedTasks() {
  return [...tasks].sort((a, b) => parseTime(a.time) - parseTime(b.time));
}

function playCalmAlarm() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  if (!alarmAudioContext) {
    alarmAudioContext = new AudioCtor();
    // Keep overlapping notes clear at full volume.
    alarmAudioOutput = alarmAudioContext.createDynamicsCompressor();
    alarmAudioOutput.threshold.value = -1;
    alarmAudioOutput.knee.value = 0;
    alarmAudioOutput.ratio.value = 20;
    alarmAudioOutput.attack.value = 0.003;
    alarmAudioOutput.release.value = 0.1;
    alarmAudioOutput.connect(alarmAudioContext.destination);
  }

  if (alarmAudioContext.state === 'suspended') {
    alarmAudioContext.resume().catch(() => {});
  }

  const selectedPattern = calmAlarmPatterns[alarmSoundSelect?.value] || calmAlarmPatterns['soft-bells'];
  const startTime = alarmAudioContext.currentTime + 0.03;

  selectedPattern.notes.forEach((frequency, index) => {
    const noteStart = startTime + index * selectedPattern.spacing;
    const noteEnd = noteStart + selectedPattern.duration;
    const oscillator = alarmAudioContext.createOscillator();
    const gain = alarmAudioContext.createGain();

    oscillator.type = selectedPattern.wave;
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(1, noteStart + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(alarmAudioOutput);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.05);
  });
}

function syncAlarmAudio() {
  const shouldPlay = Boolean(activeTaskId);

  if (!shouldPlay) {
    if (alarmLoopTimer) {
      clearInterval(alarmLoopTimer);
      alarmLoopTimer = null;
    }
    return;
  }

  if (!alarmLoopTimer) {
    playCalmAlarm();
    alarmLoopTimer = setInterval(playCalmAlarm, 7000);
  }
}

function renderAgendaPage() {
  checkActiveTask();
  const orderedTasks = sortedTasks();

  if (!orderedTasks.length) {
    agendaPage.classList.remove('task-alert');
    if (dismissAlarmBtn) dismissAlarmBtn.classList.add('hidden');
    syncAlarmAudio();
    agendaPage.innerHTML = `
      <div class="page-content">
        <p class="page-label">Agenda vazia</p>
        <h2>Sem compromissos</h2>
        <p class="page-time">Adicione uma atividade para começar.</p>
      </div>
    `;
    pageIndicator.textContent = 'Página 0 de 0';
    editCurrentTaskBtn.disabled = true;
    deleteCurrentTaskBtn.disabled = true;
    return;
  }

  if (currentPage >= orderedTasks.length) {
    currentPage = 0;
  }

  const task = orderedTasks[currentPage];
  const periodLabel = getPeriodLabel(task.time);
  const isActive = task.id === activeTaskId;

  agendaPage.classList.toggle('task-alert', isActive);

  if (dismissAlarmBtn) {
    dismissAlarmBtn.classList.toggle('hidden', !isActive);
  }

  agendaPage.innerHTML = `
    <div class="page-content ${isActive ? 'task-alert' : ''}">
      <p class="page-label">${periodLabel}</p>
      <h2>${task.time}</h2>
      <p class="page-time">${getTaskDateLabel(task)}</p>

      <div class="page-box">
        <span class="page-tag">Atividade</span>
        <h3>${task.title}</h3>
        <p><strong>Dia:</strong> ${getTaskDateLabel(task)}</p>
        <p><strong>Horário:</strong> ${task.time}</p>
        <p>${task.notes || 'Sem observações adicionais.'}</p>
      </div>
    </div>
  `;

  syncAlarmAudio();
  pageIndicator.textContent = `Página ${currentPage + 1} de ${orderedTasks.length}`;
  editCurrentTaskBtn.disabled = false;
  deleteCurrentTaskBtn.disabled = false;
}

function saveTask(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const title = formData.get('title').trim();
  const date = formData.get('date');
  const time = formData.get('time');
  const notes = formData.get('notes').trim();

  if (!title || !date || !time) return;

  if (editTaskId !== null) {
    tasks = tasks.map((task) =>
      task.id === editTaskId ? { ...task, title, date, time, notes } : task
    );
  } else {
    tasks.push({
      id: Date.now(),
      title,
      date,
      time,
      notes
    });
  }

  const orderedTasks = sortedTasks();
  currentPage = orderedTasks.findIndex((task) => task.id === (editTaskId ?? tasks[tasks.length - 1].id));

  if (currentPage < 0) {
    currentPage = 0;
  }

  form.reset();
  syncTaskTime();
  selectCalendarDate(dateToInputValue(new Date()));
  editTaskId = null;
  formTitle.textContent = 'Planeje um momento';
  cancelEditBtn.classList.add('hidden');
  renderAgendaPage();
}

function handleEditTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editTaskId = taskId;
  formTitle.textContent = 'Ajustar compromisso';
  cancelEditBtn.classList.remove('hidden');

  document.getElementById('task-title').value = task.title;
  selectCalendarDate(task.date || getNextDateForWeekday(weekdayNames.indexOf(task.day)));
  const [taskHour, taskMinute] = task.time.split(':');
  taskHourSelect.value = taskHour;
  taskMinuteSelect.value = taskMinute;
  syncTaskTime();
  document.getElementById('task-notes').value = task.notes;

  window.scrollTo({
    top: document.body.scrollHeight * 0.35,
    behavior: 'smooth'
  });
}

function handleDeleteTask(taskId) {
  tasks = tasks.filter((item) => item.id !== taskId);

  if (editTaskId === taskId) {
    editTaskId = null;
    form.reset();
    formTitle.textContent = 'Planeje um momento';
    cancelEditBtn.classList.add('hidden');
  }

  if (currentPage >= tasks.length) {
    currentPage = 0;
  }

  renderAgendaPage();
}

function cancelEdit() {
  editTaskId = null;
  form.reset();
  selectCalendarDate(dateToInputValue(new Date()));
  formTitle.textContent = 'Planeje um momento';
  cancelEditBtn.classList.add('hidden');
}

function getCurrentTask() {
  const orderedTasks = sortedTasks();
  return orderedTasks[currentPage] || null;
}

function editCurrentTask() {
  const task = getCurrentTask();
  if (!task) return;
  handleEditTask(task.id);
}

function deleteCurrentTask() {
  const task = getCurrentTask();
  if (!task) return;
  handleDeleteTask(task.id);
}

function goToPreviousPage() {
  if (!tasks.length) return;
  currentPage = (currentPage - 1 + tasks.length) % tasks.length;
  renderAgendaPage();
}

function goToNextPage() {
  if (!tasks.length) return;
  currentPage = (currentPage + 1) % tasks.length;
  renderAgendaPage();
}

function triggerManualAlert() {
  const task = getCurrentTask();
  if (!task) return;

  manualAlertTaskId = task.id;
  activeTaskId = task.id;
  silencedAlarmTaskId = null;
  silencedAlarmUntil = 0;

  if (manualAlertTimer) {
    clearTimeout(manualAlertTimer);
  }

  manualAlertTimer = setTimeout(() => {
    manualAlertTaskId = null;
    renderAgendaPage();
  }, 10000);

  syncAlarmAudio();
  renderAgendaPage();
}

function dismissAlarm() {
  const currentTask = getCurrentTask();
  if (!currentTask) return;

  manualAlertTaskId = null;
  silencedAlarmTaskId = currentTask.id;
  silencedAlarmUntil = Date.now() + 60000;
  activeTaskId = null;

  if (manualAlertTimer) {
    clearTimeout(manualAlertTimer);
    manualAlertTimer = null;
  }

  syncAlarmAudio();
  renderAgendaPage();
}

prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);
editCurrentTaskBtn.addEventListener('click', editCurrentTask);
deleteCurrentTaskBtn.addEventListener('click', deleteCurrentTask);
manualAlertBtn.addEventListener('click', triggerManualAlert);
dismissAlarmBtn.addEventListener('click', dismissAlarm);
alarmSoundSelect?.addEventListener('change', () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('incluir-alarm-sound', alarmSoundSelect.value);
  }

  if (activeTaskId) {
    clearInterval(alarmLoopTimer);
    alarmLoopTimer = null;
    syncAlarmAudio();
  }
});
previewAlarmBtn?.addEventListener('click', () => {
  playCalmAlarm();
  previewAlarmBtn.textContent = '✓ Som ativado';
  window.setTimeout(() => {
    previewAlarmBtn.textContent = '▷ Ouvir som';
  }, 1800);
});
form.addEventListener('submit', saveTask);
cancelEditBtn.addEventListener('click', cancelEdit);
calendarPrevBtn?.addEventListener('click', () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1);
  renderCalendar();
});
calendarNextBtn?.addEventListener('click', () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1);
  renderCalendar();
});

if (alertColorInput) {
  const savedColor = typeof localStorage !== 'undefined' ? localStorage.getItem('incluir-alert-color') : null;
  const themeDefaultColor = document.body.classList.contains('dark-theme') ? '#e3af35' : '#d93025';
  updateAlertColor(savedColor || themeDefaultColor);
  alertColorInput.addEventListener('input', (event) => {
    updateAlertColor(event.target.value);
    renderAgendaPage();
  });
}

colorPresetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    updateAlertColor(button.dataset.color);
    renderAgendaPage();
  });
});

if (alarmSoundSelect && typeof localStorage !== 'undefined') {
  const savedAlarmSound = localStorage.getItem('incluir-alarm-sound');
  if (savedAlarmSound && calmAlarmPatterns[savedAlarmSound]) {
    alarmSoundSelect.value = savedAlarmSound;
  }
}

setInterval(() => {
  renderAgendaPage();
}, 15000);

renderAgendaPage();
selectCalendarDate(dateToInputValue(new Date()));
