/* ===================================================================
   CalorieFlow — Smart Calorie Tracker
   Vanilla JavaScript — No frameworks, no backend, localStorage only
   Security: No innerHTML, no alert/confirm/prompt, safe DOM manipulation
   =================================================================== */

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────
  const STORAGE_KEYS = {
    MEALS: 'calorieflow_meals',
    GOAL: 'calorieflow_goal',
    WEEKLY: 'calorieflow_weekly',
  };

  const MEAL_EMOJIS = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍿',
  };

  const DEFAULT_GOAL = 2000;
  const CIRCUMFERENCE = 2 * Math.PI * 85; // r=85 from SVG

  // ─── State ───────────────────────────────────────────────────────────
  let meals = [];
  let dailyGoal = DEFAULT_GOAL;
  let confirmCallback = null;

  // ─── DOM Refs ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const dom = {
    dateDisplay: $('date-display'),
    ringProgress: $('ring-progress'),
    ringRemaining: $('ring-remaining'),
    statConsumed: $('stat-consumed'),
    statGoal: $('stat-goal'),
    statMeals: $('stat-meals'),
    macroProtein: $('macro-protein'),
    macroCarbs: $('macro-carbs'),
    macroFat: $('macro-fat'),
    proteinBar: $('protein-bar'),
    carbsBar: $('carbs-bar'),
    fatBar: $('fat-bar'),
    btnToggleForm: $('btn-toggle-form'),
    mealForm: $('meal-form'),
    mealName: $('meal-name'),
    mealCalories: $('meal-calories'),
    mealProtein: $('meal-protein'),
    mealCarbs: $('meal-carbs'),
    mealFat: $('meal-fat'),
    mealType: $('meal-type'),
    btnAddMeal: $('btn-add-meal'),
    mealList: $('meal-list'),
    emptyState: $('empty-state'),
    btnClearAll: $('btn-clear-all'),
    goalInput: $('goal-input'),
    btnSaveGoal: $('btn-save-goal'),
    weeklyChart: $('weekly-chart'),
    toastContainer: $('toast-container'),
    modalOverlay: $('modal-overlay'),
    modalTitle: $('modal-title'),
    modalMessage: $('modal-message'),
    modalCancel: $('modal-cancel'),
    modalConfirm: $('modal-confirm'),
  };

  // ─── Utilities ───────────────────────────────────────────────────────

  /** Get today's date key in YYYY-MM-DD format */
  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Format a date for display */
  function formatDisplayDate() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Sanitize numeric input — returns a clamped, validated number */
  function sanitizeNumber(value, min, max, fallback) {
    const num = parseFloat(value);
    if (isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, Math.round(num)));
  }

  /** Sanitize text input — trims and limits length */
  function sanitizeText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
  }

  /** Validate meal type against allowed values */
  function isValidMealType(type) {
    return ['breakfast', 'lunch', 'dinner', 'snack'].includes(type);
  }

  /** Generate a simple unique ID */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Animate a number counting up */
  function animateNumber(element, target, duration) {
    const start = parseInt(element.textContent) || 0;
    if (start === target) return;

    const startTime = performance.now();
    const diff = target - start;

    function tick(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      element.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  // ─── LocalStorage ───────────────────────────────────────────────────

  function loadMeals() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MEALS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const todayKey = getTodayKey();
      // Only return today's meals
      if (parsed && parsed.date === todayKey && Array.isArray(parsed.items)) {
        return parsed.items;
      }
      // If date doesn't match, archive to weekly and return empty
      if (parsed && parsed.date && Array.isArray(parsed.items)) {
        archiveDayToWeekly(parsed.date, parsed.items);
      }
      return [];
    } catch {
      return [];
    }
  }

  function saveMeals() {
    try {
      const data = { date: getTodayKey(), items: meals };
      localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(data));
    } catch {
      // Storage full or unavailable
    }
  }

  function loadGoal() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GOAL);
      if (!stored) return DEFAULT_GOAL;
      const num = parseInt(stored, 10);
      if (isNaN(num) || num < 500 || num > 10000) return DEFAULT_GOAL;
      return num;
    } catch {
      return DEFAULT_GOAL;
    }
  }

  function saveGoal(goal) {
    try {
      localStorage.setItem(STORAGE_KEYS.GOAL, String(goal));
    } catch {
      // Storage full or unavailable
    }
  }

  function loadWeeklyData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  function saveWeeklyData(data) {
    try {
      localStorage.setItem(STORAGE_KEYS.WEEKLY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable
    }
  }

  function archiveDayToWeekly(dateKey, items) {
    const weekly = loadWeeklyData();
    const totalCals = items.reduce((sum, m) => sum + (m.calories || 0), 0);
    weekly[dateKey] = totalCals;

    // Keep only last 14 days of data
    const keys = Object.keys(weekly).sort();
    if (keys.length > 14) {
      keys.slice(0, keys.length - 14).forEach((k) => delete weekly[k]);
    }
    saveWeeklyData(weekly);
  }

  // ─── Ring Progress ──────────────────────────────────────────────────

  /** Add a gradient definition to the SVG for the progress ring */
  function initRingGradient() {
    const svg = dom.ringProgress.closest('svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'progress-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stops = [
      { offset: '0%', color: '#ff6b6b' },
      { offset: '50%', color: '#ff8e53' },
      { offset: '100%', color: '#ffc857' },
    ];

    stops.forEach((s) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', s.offset);
      stop.setAttribute('stop-color', s.color);
      gradient.appendChild(stop);
    });

    defs.appendChild(gradient);
    svg.insertBefore(defs, svg.firstChild);
  }

  function updateRing(consumed, goal) {
    const ratio = Math.min(consumed / goal, 1);
    const offset = CIRCUMFERENCE * (1 - ratio);
    dom.ringProgress.style.strokeDasharray = CIRCUMFERENCE;
    dom.ringProgress.style.strokeDashoffset = offset;

    const remaining = Math.max(goal - consumed, 0);
    animateNumber(dom.ringRemaining, remaining, 500);
  }

  // ─── Dashboard Update ──────────────────────────────────────────────

  function updateDashboard() {
    const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
    const protein = meals.reduce((sum, m) => sum + (m.protein || 0), 0);
    const carbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
    const fat = meals.reduce((sum, m) => sum + (m.fat || 0), 0);

    // Stats
    animateNumber(dom.statConsumed, consumed, 400);
    animateNumber(dom.statGoal, dailyGoal, 300);
    dom.statMeals.textContent = meals.length;

    // Ring
    updateRing(consumed, dailyGoal);

    // Macros
    dom.macroProtein.textContent = protein + 'g';
    dom.macroCarbs.textContent = carbs + 'g';
    dom.macroFat.textContent = fat + 'g';

    // Macro bars (arbitrary daily targets: protein 150g, carbs 300g, fat 65g)
    dom.proteinBar.style.width = Math.min((protein / 150) * 100, 100) + '%';
    dom.carbsBar.style.width = Math.min((carbs / 300) * 100, 100) + '%';
    dom.fatBar.style.width = Math.min((fat / 65) * 100, 100) + '%';

    // Update weekly with current day's data
    const weekly = loadWeeklyData();
    weekly[getTodayKey()] = consumed;
    saveWeeklyData(weekly);
    renderWeeklyChart();
  }

  // ─── Meal List Rendering ───────────────────────────────────────────

  function renderMealList() {
    // Remove existing meal items (but keep empty state)
    const existingItems = dom.mealList.querySelectorAll('.meal-item');
    existingItems.forEach((item) => item.remove());

    if (meals.length === 0) {
      dom.emptyState.style.display = 'flex';
      return;
    }

    dom.emptyState.style.display = 'none';

    meals.forEach((meal, index) => {
      const item = createMealElement(meal, index);
      dom.mealList.appendChild(item);
    });
  }

  function createMealElement(meal, index) {
    const item = document.createElement('div');
    item.className = 'meal-item';
    item.style.animationDelay = `${index * 0.05}s`;
    item.setAttribute('data-id', meal.id);

    // Type badge
    const badge = document.createElement('div');
    badge.className = `meal-type-badge ${meal.type}`;
    badge.textContent = MEAL_EMOJIS[meal.type] || '🍽️';
    item.appendChild(badge);

    // Info
    const info = document.createElement('div');
    info.className = 'meal-info';

    const name = document.createElement('div');
    name.className = 'meal-name';
    name.textContent = meal.name;
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'meal-meta';

    const macros = [];
    if (meal.protein) macros.push(`P: ${meal.protein}g`);
    if (meal.carbs) macros.push(`C: ${meal.carbs}g`);
    if (meal.fat) macros.push(`F: ${meal.fat}g`);

    if (macros.length > 0) {
      macros.forEach((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        meta.appendChild(span);
      });
    } else {
      const span = document.createElement('span');
      span.textContent = meal.type.charAt(0).toUpperCase() + meal.type.slice(1);
      meta.appendChild(span);
    }

    info.appendChild(meta);
    item.appendChild(info);

    // Calories display
    const cals = document.createElement('span');
    cals.className = 'meal-calories-display';
    cals.textContent = meal.calories;
    item.appendChild(cals);

    // Delete button - uses DOMParser for the SVG (security: avoids innerHTML)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'meal-delete-btn';
    deleteBtn.setAttribute('type', 'button');
    deleteBtn.setAttribute('aria-label', `Delete ${meal.name}`);

    const svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const svgDoc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    deleteBtn.appendChild(svgDoc.documentElement);

    deleteBtn.addEventListener('click', () => {
      deleteMeal(meal.id, item);
    });

    item.appendChild(deleteBtn);

    return item;
  }

  function deleteMeal(id, element) {
    element.classList.add('removing');
    setTimeout(() => {
      meals = meals.filter((m) => m.id !== id);
      saveMeals();
      renderMealList();
      updateDashboard();
      showToast('Meal removed', 'info');
    }, 300);
  }

  // ─── Weekly Chart ──────────────────────────────────────────────────

  function renderWeeklyChart() {
    // Clear existing chart content safely
    dom.weeklyChart.replaceChildren();

    const weekly = loadWeeklyData();
    const today = new Date();
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get the start of the week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    let maxCal = dailyGoal;
    const weekData = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const cals = weekly[key] || 0;
      if (cals > maxCal) maxCal = cals;

      weekData.push({
        label: dayLabels[d.getDay()],
        value: cals,
        isToday: key === getTodayKey(),
        isFuture: d > today && key !== getTodayKey(),
        key,
      });
    }

    weekData.forEach((day) => {
      const col = document.createElement('div');
      col.className = 'week-day';

      // Value label
      const value = document.createElement('span');
      value.className = 'week-value';
      value.textContent = day.value > 0 ? day.value : '';
      col.appendChild(value);

      // Bar container
      const barContainer = document.createElement('div');
      barContainer.className = 'week-bar-container';

      const bar = document.createElement('div');
      bar.className = 'week-bar';
      if (day.isToday) bar.classList.add('today');
      if (day.isFuture) bar.classList.add('future');

      const height = maxCal > 0 ? Math.max((day.value / maxCal) * 100, 3) : 3;
      bar.style.height = (day.isFuture ? 3 : height) + '%';

      barContainer.appendChild(bar);
      col.appendChild(barContainer);

      // Day label
      const label = document.createElement('span');
      label.className = 'week-label';
      if (day.isToday) label.classList.add('today');
      label.textContent = day.label;
      col.appendChild(label);

      dom.weeklyChart.appendChild(col);
    });
  }

  // ─── Toast (replaces alert) ────────────────────────────────────────

  function showToast(message, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon via DOMParser (security: avoids innerHTML)
    const icons = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#34d399" stroke-width="2"/><path d="M7 10L9 12L13 8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#f87171" stroke-width="2"/><path d="M7 7L13 13M13 7L7 13" stroke="#f87171" stroke-width="2" stroke-linecap="round"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#60a5fa" stroke-width="2"/><path d="M10 9V14" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="7" r="1" fill="#60a5fa"/></svg>',
    };

    const iconDoc = new DOMParser().parseFromString(icons[type] || icons.info, 'image/svg+xml');
    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast-icon';
    iconWrap.appendChild(iconDoc.documentElement);
    toast.appendChild(iconWrap);

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(msg);

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── Confirm Modal (replaces native confirm) ──────────────────────

  function showConfirmModal(title, message, onConfirm) {
    dom.modalTitle.textContent = title;
    dom.modalMessage.textContent = message;
    dom.modalOverlay.removeAttribute('hidden');
    confirmCallback = onConfirm;

    // Focus the cancel button for accessibility
    setTimeout(() => dom.modalCancel.focus(), 50);
  }

  function hideModal() {
    dom.modalOverlay.setAttribute('hidden', '');
    confirmCallback = null;
  }

  // ─── Form Handling ─────────────────────────────────────────────────

  function toggleForm() {
    const form = dom.mealForm;
    const btn = dom.btnToggleForm;
    const isCollapsed = form.classList.contains('collapsed');

    if (isCollapsed) {
      form.classList.remove('collapsed');
      btn.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => dom.mealName.focus(), 350);
    } else {
      form.classList.add('collapsed');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function clearFormErrors() {
    dom.mealName.classList.remove('error');
    dom.mealCalories.classList.remove('error');
  }

  function handleAddMeal(e) {
    e.preventDefault();
    clearFormErrors();

    const name = sanitizeText(dom.mealName.value, 100);
    const calories = sanitizeNumber(dom.mealCalories.value, 0, 10000, -1);
    const protein = sanitizeNumber(dom.mealProtein.value, 0, 1000, 0);
    const carbs = sanitizeNumber(dom.mealCarbs.value, 0, 1000, 0);
    const fat = sanitizeNumber(dom.mealFat.value, 0, 1000, 0);
    const type = isValidMealType(dom.mealType.value) ? dom.mealType.value : 'snack';

    let hasError = false;

    if (!name) {
      dom.mealName.classList.add('error');
      hasError = true;
    }

    if (calories < 0) {
      dom.mealCalories.classList.add('error');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fill in the required fields', 'error');
      return;
    }

    const meal = {
      id: generateId(),
      name,
      calories,
      protein,
      carbs,
      fat,
      type,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    meals.push(meal);
    saveMeals();
    renderMealList();
    updateDashboard();

    // Reset form
    dom.mealForm.reset();
    dom.mealType.value = 'breakfast';

    showToast(`${meal.name} added — ${meal.calories} kcal`, 'success');

    // Check if over goal
    const totalConsumed = meals.reduce((sum, m) => sum + m.calories, 0);
    if (totalConsumed > dailyGoal) {
      setTimeout(() => {
        showToast('You\'ve exceeded your daily calorie goal!', 'error');
      }, 600);
    }
  }

  // ─── Goal Handling ─────────────────────────────────────────────────

  function handleSaveGoal() {
    const val = sanitizeNumber(dom.goalInput.value, 500, 10000, DEFAULT_GOAL);
    dailyGoal = val;
    dom.goalInput.value = val;
    saveGoal(val);
    updateDashboard();
    updatePresetButtons(val);
    showToast(`Daily goal set to ${val} kcal`, 'success');
  }

  function updatePresetButtons(activeValue) {
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      const v = parseInt(btn.getAttribute('data-value'), 10);
      if (v === activeValue) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // ─── Event Bindings ────────────────────────────────────────────────

  function bindEvents() {
    // Toggle form
    dom.btnToggleForm.addEventListener('click', toggleForm);

    // Add meal
    dom.mealForm.addEventListener('submit', handleAddMeal);

    // Clear input errors on focus
    dom.mealName.addEventListener('focus', () => dom.mealName.classList.remove('error'));
    dom.mealCalories.addEventListener('focus', () => dom.mealCalories.classList.remove('error'));

    // Clear all meals
    dom.btnClearAll.addEventListener('click', () => {
      if (meals.length === 0) {
        showToast('No meals to clear', 'info');
        return;
      }
      showConfirmModal(
        'Clear All Meals',
        'Are you sure you want to remove all meals logged today? This cannot be undone.',
        () => {
          meals = [];
          saveMeals();
          renderMealList();
          updateDashboard();
          showToast('All meals cleared', 'info');
        }
      );
    });

    // Save goal
    dom.btnSaveGoal.addEventListener('click', handleSaveGoal);

    // Goal input enter key
    dom.goalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveGoal();
      }
    });

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-value'), 10);
        if (!isNaN(val)) {
          dom.goalInput.value = val;
          handleSaveGoal();
        }
      });
    });

    // Modal
    dom.modalCancel.addEventListener('click', hideModal);
    dom.modalConfirm.addEventListener('click', () => {
      if (typeof confirmCallback === 'function') {
        confirmCallback();
      }
      hideModal();
    });

    // Close modal on overlay click
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) {
        hideModal();
      }
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.modalOverlay.hasAttribute('hidden')) {
        hideModal();
      }
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────

  function init() {
    // Set date
    dom.dateDisplay.textContent = formatDisplayDate();

    // Init SVG gradient
    initRingGradient();

    // Load data
    dailyGoal = loadGoal();
    meals = loadMeals();

    // Set goal input
    dom.goalInput.value = dailyGoal;
    updatePresetButtons(dailyGoal);

    // Initialize ring
    dom.ringProgress.style.strokeDasharray = CIRCUMFERENCE;
    dom.ringProgress.style.strokeDashoffset = CIRCUMFERENCE;

    // Render
    renderMealList();
    updateDashboard();

    // Bind events
    bindEvents();

    // Archive today's data at midnight
    scheduleMidnightReset();
  }

  function scheduleMidnightReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      // Archive current day
      if (meals.length > 0) {
        archiveDayToWeekly(getTodayKey(), meals);
      }
      // Reset
      meals = [];
      saveMeals();
      renderMealList();
      updateDashboard();
      dom.dateDisplay.textContent = formatDisplayDate();
      showToast('New day! Your meal log has been reset.', 'info');

      // Schedule next reset
      scheduleMidnightReset();
    }, msUntilMidnight);
  }

  // ─── Start ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
