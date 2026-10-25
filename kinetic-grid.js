(() => {
  const canvas = document.getElementById('kinetic-grid');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const cellSize = 55;
  const influenceRadius = 260;
  const maxWarp = 24;
  const dotSpacing = 28;
  const smoothing = 0.08;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = { x: -9999, y: -9999 };
  const targetMouse = { x: -9999, y: -9999 };
  const ripples = [];
  let width = 0;
  let height = 0;
  let frameId = 0;

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const warpedPoint = (x, y, column, row, columns, rows) => {
    const edge = 1.5;
    const columnPin = Math.min(column / edge, (columns - 1 - column) / edge, 1);
    const rowPin = Math.min(row / edge, (rows - 1 - row) / edge, 1);
    const pin = columnPin * columnPin * rowPin * rowPin;
    const dx = x - mouse.x;
    const dy = y - mouse.y;
    const distance = Math.hypot(dx, dy);
    const proximity = Math.max(0, 1 - distance / influenceRadius) * pin;
    let rippleX = 0;
    let rippleY = 0;

    ripples.forEach((ripple) => {
      const rippleDx = x - ripple.x;
      const rippleDy = y - ripple.y;
      const rippleDistance = Math.hypot(rippleDx, rippleDy);
      const difference = rippleDistance - ripple.radius;
      const waveWidth = 55;
      if (Math.abs(difference) >= waveWidth || !rippleDistance) return;
      const strength = (1 - Math.abs(difference) / waveWidth) * ripple.opacity * 18 * pin;
      const direction = difference < 0 ? 1 : -1;
      rippleX += Math.cos(Math.atan2(rippleDy, rippleDx)) * strength * direction;
      rippleY += Math.sin(Math.atan2(rippleDy, rippleDx)) * strength * direction;
    });

    if (!reducedMotion.matches && distance < influenceRadius && distance > 0 && pin > 0) {
      const normalizedDistance = distance / influenceRadius;
      const eased = (1 - normalizedDistance) ** 2 * Math.min(1, distance / 60);
      const amount = eased * maxWarp * pin;
      const angle = Math.atan2(dy, dx);
      return { x: x - Math.cos(angle) * amount + rippleX, y: y - Math.sin(angle) * amount + rippleY, proximity };
    }

    return { x: x + rippleX, y: y + rippleY, proximity };
  };

  const draw = (now) => {
    const isDeepTheme = document.body.classList.contains('dark-theme');
    const palette = isDeepTheme
      ? { background: '#050506', base: [255, 255, 255], active: [227, 175, 53], ripple: '227,175,53', dots: 'rgba(255,255,255,0.05)' }
      : { background: '#f8f9fa', base: [191, 193, 197], active: [26, 115, 232], ripple: '26,115,232', dots: 'rgba(60,64,67,0.045)' };
    context.clearRect(0, 0, width, height);
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);

    context.fillStyle = palette.dots;
    for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
      for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
        context.beginPath();
        context.arc(x, y, 0.7, 0, Math.PI * 2);
        context.fill();
      }
    }

    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      const age = (now - ripple.born) / 1000;
      ripple.radius = Math.max(0, age * 400);
      ripple.opacity = Math.max(0, 1 - age * 1.2);
      if (!ripple.opacity) ripples.splice(index, 1);
    }

    const columns = Math.max(2, Math.ceil(width / cellSize)) + 1;
    const rows = Math.max(2, Math.ceil(height / cellSize)) + 1;
    const cellWidth = width / (columns - 1);
    const cellHeight = height / (rows - 1);
    const points = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, column) => warpedPoint(column * cellWidth, row * cellHeight, column, row, columns, rows))
    );

    const drawSegment = (first, second) => {
      const proximity = (first.proximity + second.proximity) / 2;
      const active = proximity * proximity * (3 - 2 * proximity);
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.strokeStyle = `rgba(${palette.base.map((channel, index) => Math.round(channel + (palette.active[index] - channel) * active)).join(',')},${(0.13 + active * 0.77).toFixed(3)})`;
      context.lineWidth = 0.8 + active * 0.7;
      context.stroke();
    };

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns - 1; column += 1) drawSegment(points[row][column], points[row][column + 1]);
    }
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows - 1; row += 1) drawSegment(points[row][column], points[row + 1][column]);
    }

    points.flat().forEach((point) => {
      const active = point.proximity * point.proximity * (3 - 2 * point.proximity);
      context.beginPath();
      context.arc(point.x, point.y, 1.8 + active * 1.4, 0, Math.PI * 2);
      context.fillStyle = `rgba(${palette.base.map((channel, index) => Math.round(channel + (palette.active[index] - channel) * active)).join(',')},${(0.2 + active * 0.8).toFixed(3)})`;
      context.fill();
    });

    ripples.forEach((ripple) => {
      context.beginPath();
      context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${palette.ripple},${(ripple.opacity * 0.28).toFixed(3)})`;
      context.lineWidth = 1.5;
      context.stroke();
    });
  };

  const animate = (now) => {
    mouse.x += (targetMouse.x - mouse.x) * smoothing;
    mouse.y += (targetMouse.y - mouse.y) * smoothing;
    draw(now);
    frameId = requestAnimationFrame(animate);
  };

  window.addEventListener('pointermove', (event) => {
    targetMouse.x = event.clientX;
    targetMouse.y = event.clientY;
  }, { passive: true });
  window.addEventListener('click', (event) => {
    if (!reducedMotion.matches) ripples.push({ x: event.clientX, y: event.clientY, radius: 0, opacity: 1, born: performance.now() });
  });
  window.addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) ripples.length = 0;
  });

  resize();
  frameId = requestAnimationFrame(animate);
  window.addEventListener('beforeunload', () => cancelAnimationFrame(frameId), { once: true });
})();
