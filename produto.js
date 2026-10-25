(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealItems = [...document.querySelectorAll('[data-reveal]')];

  revealItems.forEach((item) => {
    if (item.dataset.delay) item.style.setProperty('--reveal-delay', `${item.dataset.delay}ms`);
  });

  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const viewer = document.querySelector('#model-viewer');
  let viewerStarted = false;
  async function startViewer() {
    if (viewerStarted) return;
    viewerStarted = true;
    try {
      const { mountProductViewer } = await import('./product-model.bundle.js');
      await mountProductViewer({ reducedMotion: reducedMotion.matches });
    } catch (error) {
      console.warn('Não foi possível iniciar o visualizador.', error);
      viewer.dataset.state = 'error';
      document.querySelector('#model-status').textContent = 'O visualizador não carregou. A foto permanece disponível.';
    }
  }
  if (viewer && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); startViewer();
    }, { rootMargin: '260px' });
    observer.observe(viewer);
  } else if (viewer) startViewer();

  const section = document.querySelector('#sequencia');
  const list = section.querySelector('.sequence-steps');
  const sequenceReadout = document.querySelector('#sequence-readout');
  const currentActivity = document.querySelector('#sequence-current-activity');
  const currentSignal = document.querySelector('#sequence-current-signal');
  const previousButton = document.querySelector('#sequence-previous');
  const nextButton = document.querySelector('#sequence-next');
  const playButton = document.querySelector('#sequence-play');
  const motionNote = document.querySelector('#sequence-motion-note');
  const audioButton = document.querySelector('#sequence-audio-toggle');
  const audioNote = document.querySelector('#sequence-audio-note');
  const COLORS = {
    vermelho: { name: 'Vermelho', signal: 'vermelha', className: 'light-red', hex: '#ef5a52' },
    amarelo: { name: 'Amarelo', signal: 'amarela', className: 'light-yellow', hex: '#ebc454' },
    verde: { name: 'Verde', signal: 'verde', className: 'light-green', hex: '#60ae89' },
    azul: { name: 'Azul', signal: 'azul', className: 'light-blue', hex: '#6b96ee' },
    branco: { name: 'Branco', signal: 'branca', className: 'light-white', hex: '#f0efe5' },
  };
  // Illustrative patterns, inspired by the briefing; not buzzer recordings.
  const SOUNDS = {
    A: [{ frequency: 587.33, start: 0, duration: .24 }, { frequency: 880, start: .3, duration: .32 }],
    // Midrange notes carry better on phone and laptop speakers than the former bass tones.
    B: [{ frequency: 392, start: 0, duration: .36 }, { frequency: 349.23, start: .45, duration: .4 }],
    C: [{ frequency: 523.25, start: 0, duration: .2 }, { frequency: 659.25, start: .24, duration: .2 }, { frequency: 783.99, start: .48, duration: .32 }],
    D: [{ frequency: 659.25, start: 0, duration: .26 }, { frequency: 440, start: .32, duration: .4 }],
    E: [{ frequency: 329.63, start: 0, duration: 1.5 }],
  };
  const items = [...list.querySelectorAll('li')].map((step, index) => ({
    activity: step.querySelector('.sequence-activity').textContent,
    color: step.dataset.colorName.toLowerCase(),
    sound: String.fromCharCode(65 + index),
    time: ['14:00', '15:30', '16:30', '18:00', '20:30'][index],
  }));
  let activeStep = 0;
  let playbackTimer = null;
  let audioContext = null;
  let audioEnabled = false;
  const voices = new Set();

  function stopSounds() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    for (const voice of voices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, .015);
      try { voice.oscillator.stop(now + .06); } catch {}
    }
  }

  function playSound() {
    stopSounds();
    if (!audioEnabled || audioContext?.state !== 'running' || document.hidden) return;
    for (const note of SOUNDS[items[activeStep].sound]) {
      const start = audioContext.currentTime + note.start;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const voice = { oscillator, gain };
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      const peak = 1; // Full-scale output; the device volume still applies.
      const attack = Math.min(.12, note.duration / 3);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      gain.gain.setValueAtTime(peak, start + note.duration * .55);
      gain.gain.linearRampToValueAtTime(0, start + note.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect(); voices.delete(voice);
      };
      voices.add(voice);
      oscillator.start(start);
      oscillator.stop(start + note.duration + .02);
    }
  }

  function updateSequence(announce = true) {
    const item = items[activeStep];
    [...list.children].forEach((step, index) => {
      if (index === activeStep) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      step.querySelector('button').setAttribute('aria-pressed', String(index === activeStep));
    });
    const color = COLORS[item.color];
    section.style.setProperty('--selected-signal', color.hex);
    currentActivity.textContent = item.activity;
    currentSignal.textContent = `${item.time} · Luz ${color.signal} · Som ${item.sound}`;
    sequenceReadout.setAttribute('aria-live', announce ? 'polite' : 'off');
    sequenceReadout.textContent = `Exemplo ${activeStep + 1} de ${items.length}: ${item.color}, som ${item.sound}, ${item.activity.toLowerCase()}.`;
  }

  function renderSequence() {
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const color = COLORS[item.color];
      const li = document.createElement('li');
      li.dataset.step = String(index);
      li.dataset.colorName = color.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sequence-select';
      button.setAttribute('aria-label', `Exemplo ${index + 1}: ${color.name}, ${item.activity.toLowerCase()}, som ${item.sound}`);
      button.setAttribute('aria-describedby', `sequence-time-${index}`);
      const number = document.createElement('span');
      number.className = 'sequence-number';
      number.id = `sequence-time-${index}`;
      number.textContent = `${item.time} / SOM ${item.sound}`;
      const light = document.createElement('span');
      light.className = `sequence-light ${color.className}`;
      light.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'sequence-label'; label.textContent = color.name;
      const activity = document.createElement('span');
      activity.className = 'sequence-activity'; activity.textContent = item.activity;
      button.append(number, light, label, activity);
      button.addEventListener('click', () => selectStep(index));
      li.append(button); fragment.append(li);
    });
    list.replaceChildren(fragment);
    updateSequence();
  }

  function stopPlayback() {
    if (playbackTimer !== null) window.clearInterval(playbackTimer);
    playbackTimer = null;
    stopSounds();
    playButton.setAttribute('aria-pressed', 'false');
    playButton.innerHTML = '<span aria-hidden="true">▶</span> Reproduzir sequência';
    updateSequence();
  }

  function selectStep(index) {
    stopPlayback();
    activeStep = (index + items.length) % items.length;
    updateSequence(); playSound();
  }
  previousButton.addEventListener('click', () => selectStep(activeStep - 1));
  nextButton.addEventListener('click', () => selectStep(activeStep + 1));
  playButton.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    if (playbackTimer !== null) { stopPlayback(); return; }
    if (activeStep === items.length - 1) activeStep = 0;
    updateSequence(false); playSound();
    playButton.setAttribute('aria-pressed', 'true');
    playButton.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pausar sequência';
    playbackTimer = window.setInterval(() => {
      if (activeStep === items.length - 1) { stopPlayback(); return; }
      activeStep += 1;
      updateSequence(false); playSound();
    }, 3000);
  });

  function renderAudioControl() {
    audioButton.setAttribute('aria-pressed', String(audioEnabled));
    audioButton.innerHTML = `<span aria-hidden="true">♪</span> ${audioEnabled ? 'Desativar' : 'Ativar'} áudio`;
    audioNote.textContent = `${audioEnabled ? 'Áudio ativado' : 'Áudio desligado'}. Os sons desta demonstração são ilustrativos, não gravações do buzzer real.`;
  }
  audioButton.addEventListener('click', async () => {
    audioEnabled = !audioEnabled;
    renderAudioControl();
    if (!audioEnabled) { stopSounds(); return; }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio unavailable');
      audioContext ||= new AudioContext();
      await audioContext.resume();
      if (audioEnabled) playSound();
    } catch {
      audioEnabled = false; renderAudioControl();
      audioNote.textContent = 'Áudio indisponível neste navegador. As cores, atividades e referências sonoras continuam identificadas em texto.';
    }
  });
  function applyMotionPreference() {
    if (reducedMotion.matches) stopPlayback();
    playButton.disabled = reducedMotion.matches;
    motionNote.hidden = !reducedMotion.matches;
  }
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', applyMotionPreference);
  else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(applyMotionPreference);
  function quiet() { stopPlayback(); audioEnabled = false; renderAudioControl(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) quiet(); });
  section.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    quiet();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) quiet(); }).observe(section);
  }
  window.addEventListener('pagehide', () => {
    quiet(); audioContext?.close().catch(() => {}); audioContext = null;
  });
  renderSequence();
  renderAudioControl();
  applyMotionPreference();
})();
