(function (root) {
  'use strict';
  // Character and sample answers ported from AIOrchestration. No network AI service.
  const greeting = '안녕하세요! AI 슈퍼바이저 어시스턴트입니다. 무엇을 도와드릴까요?';
  function sampleReply(question) {
    if (/불량률|defect|不良率/i.test(question)) return '현재 전체 라인의 평균 불량률은 3.2%입니다. B라인의 도금 공정에서 미세한 변동이 감지되었으나, 허용 범위 내에 있습니다.';
    if (/가동률|OEE|utilization|稼働率/i.test(question)) return '오늘의 종합 설비 효율(OEE)은 87.5%로 목표치(85%)를 상회하고 있습니다. 특히 조립 라인의 성능 지표가 전일 대비 4% 향상되었습니다.';
    if (/안전|safety|安全/i.test(question)) return '현재 모든 안전 센서가 정상 작동 중입니다. 구역 C에서 작업자 1명이 보호구 미착용으로 경고 조치되었으며, 현재는 시정 완료되었습니다.';
    return '요청하신 내용을 분석 중입니다. Supervisor 에이전트가 관련 데이터를 취합하여 최적의 답변을 준비하고 있습니다.';
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
  function bubbleLayout(bounds, character, size) {
    const margin = 16, gap = 24;
    let placement = 'left';
    let left = character.left - size.width - gap;
    let top = character.top + character.height / 2 - size.height + 48;
    if (left < margin) {
      left = character.left + character.width + gap;
      placement = 'right';
      if (left + size.width > bounds.width - margin) {
        left = character.left + character.width / 2 - size.width / 2;
        placement = character.top > bounds.height / 2 ? 'above' : 'below';
        top = placement === 'above' ? character.top - size.height - gap : character.top + character.height + gap;
      }
    }
    left = clamp(left, margin, bounds.width - size.width - margin);
    top = clamp(top, margin, bounds.height - size.height - margin);
    return { left, top, placement,
      tailTop: clamp(character.top + character.height / 2 - top - 7, 22, size.height - 36),
      tailLeft: clamp(character.left + character.width / 2 - left - 7, 22, size.width - 36) };
  }
  if (typeof module === 'object' && module.exports) { module.exports = { sampleReply, bubbleLayout }; return; }
  const layer = document.getElementById('monitor-companion');
  if (!layer) return;
  const viewport = document.getElementById('viewport');
  const host = document.getElementById('companion-character');
  const figure = document.getElementById('companion-figure');
  const summon = document.getElementById('companion-summon');
  const panel = document.getElementById('companion-chat');
  // Escape the scene's clipping and stacking context; native modal dialogs stay above it.
  document.body.append(host, panel);
  const titleBar = panel.querySelector('.companion-chat-header');
  const messages = document.getElementById('companion-messages');
  const input = document.getElementById('companion-input');
  const send = document.getElementById('companion-send');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0, active: false };
  let restartAnimation = () => {}, moved = false, drag = null, suppressClick = false, replyTimer = null, pending = null;
  let summonFrame = 0;
  let chatDrag = null, chatPosition = null;
  const screenBounds = () => ({ width: document.documentElement.clientWidth, height: root.innerHeight });
  function stopSummon() {
    if (summonFrame) cancelAnimationFrame(summonFrame);
    summonFrame = 0;
  }

  function localCharacter() {
    return { left: host.offsetLeft, top: host.offsetTop, width: host.offsetWidth, height: host.offsetHeight };
  }
  function positionChat() {
    if (panel.hidden || host.hidden) return;
    const bounds = screenBounds(), character = localCharacter();
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };
    if (chatPosition) {
      chatPosition.left = clamp(chatPosition.left, 16, bounds.width - size.width - 16);
      chatPosition.top = clamp(chatPosition.top, 16, bounds.height - size.height - 16);
      panel.style.left = chatPosition.left + 'px'; panel.style.top = chatPosition.top + 'px';
      panel.dataset.placement = 'detached';
      return;
    }
    const position = bubbleLayout(bounds, character, size);
    panel.dataset.placement = position.placement;
    panel.style.left = position.left + 'px'; panel.style.top = position.top + 'px';
    panel.style.setProperty('--tail-top', position.tailTop + 'px');
    panel.style.setProperty('--tail-left', position.tailLeft + 'px');
  }
  function placeCharacter(x, y) {
    // Reserve room for the original character's floating animation at every edge.
    const bounds = screenBounds();
    host.style.left = clamp(x, 28, bounds.width - host.offsetWidth - 28) + 'px';
    host.style.top = clamp(y, 28, bounds.height - host.offsetHeight - 28) + 'px';
    host.style.right = 'auto'; host.style.bottom = 'auto';
    positionChat();
  }
  function closeChat(restoreFocus = false) {
    endChatDrag();
    panel.hidden = true;
    figure.setAttribute('aria-expanded', 'false');
    figure.setAttribute('aria-label', 'AI 챗봇 열기');
    if (restoreFocus && !host.hidden) figure.focus({ preventScroll: true });
  }
  function toggleChat() {
    if (host.hidden || layer.hidden) return;
    if (!panel.hidden) { closeChat(true); return; }
    panel.hidden = false;
    chatPosition = null;
    figure.setAttribute('aria-expanded', 'true'); figure.setAttribute('aria-label', 'AI 챗봇 닫기');
    if (!messages.childElementCount) appendMessage('assistant', greeting);
    positionChat(); scrollToLatest(); input.focus({ preventScroll: true });
  }
  function setVisible(visible) {
    stopSummon();
    closeChat(); host.hidden = !visible;
    summon.setAttribute('aria-pressed', String(visible));
    const label = visible ? 'AI 캐릭터 숨기기' : 'AI 캐릭터 호출';
    summon.setAttribute('aria-label', label); summon.title = label;
    if (visible) {
      if (!moved) {
        const anchor = summon.getBoundingClientRect();
        placeCharacter(anchor.left + anchor.width / 2 - host.offsetWidth / 2, anchor.top - host.offsetHeight - 20);
      } else {
        const box = localCharacter(); placeCharacter(box.left, box.top);
      }
    }
    restartAnimation();
  }
  // Views report only genuine empty-space hits (canvas equipment needs ray picking).
  viewport.addEventListener('fems-background-dblclick', event => {
    if (layer.hidden || host.hidden || drag) return;
    const { clientX, clientY } = event.detail;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    stopSummon();
    closeChat();
    const bounds = screenBounds(), start = localCharacter();
    const x = clamp(clientX - start.width / 2, 28, bounds.width - start.width - 28);
    const y = clamp(clientY - start.height / 2, 28, bounds.height - start.height - 28);
    moved = true;
    if (reducedMotion.matches) { placeCharacter(x, y); return; }
    const started = performance.now();
    function travel(now) {
      const progress = Math.min(1, (now - started) / 300), ease = 1 - (1 - progress) ** 3;
      placeCharacter(start.left + (x - start.left) * ease, start.top + (y - start.top) * ease);
      summonFrame = progress < 1 ? requestAnimationFrame(travel) : 0;
    }
    summonFrame = requestAnimationFrame(travel);
  });
  function scrollToLatest() { messages.scrollTop = messages.scrollHeight; }
  function appendMessage(role, content) {
    const row = document.createElement('div'), bubble = document.createElement('p'), time = document.createElement('time');
    row.className = 'companion-message'; row.dataset.role = role;
    if (role === 'user') bubble.setAttribute('data-i18n-skip', '');
    bubble.textContent = content;
    const now = new Date(); time.dateTime = now.toISOString(); time.setAttribute('data-i18n-skip', '');
    time.textContent = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
    row.append(bubble, time); messages.append(row); scrollToLatest(); return row;
  }
  function updateSendButton() { send.disabled = replyTimer !== null || !input.value.trim(); }
  function submit(event) {
    event.preventDefault();
    if (layer.hidden || panel.hidden || replyTimer !== null || !input.value.trim()) return;
    const question = input.value.trim();
    appendMessage('user', question); input.value = '';
    pending = appendMessage('assistant', '답변 작성 중…'); pending.setAttribute('data-pending', '');
    messages.setAttribute('aria-busy', 'true');
    replyTimer = window.setTimeout(() => {
      pending?.remove(); pending = null; replyTimer = null;
      appendMessage('assistant', sampleReply(question)); messages.setAttribute('aria-busy', 'false'); updateSendButton();
    }, 1500);
    updateSendButton(); input.focus({ preventScroll: true });
  }
  document.getElementById('companion-form').addEventListener('submit', submit);
  input.addEventListener('input', updateSendButton);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) submit(event);
  });
  document.getElementById('companion-close').addEventListener('click', () => closeChat(true));
  panel.querySelectorAll('.companion-suggestions button').forEach(button => button.addEventListener('click', () => {
    input.value = button.textContent; updateSendButton(); input.focus({ preventScroll: true });
  }));
  summon.addEventListener('click', () => setVisible(host.hidden));
  figure.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    toggleChat();
  });
  figure.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    stopSummon();
    const box = localCharacter(); suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top, moved: false };
    figure.setPointerCapture(event.pointerId);
  });
  figure.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) closeChat();
    drag.moved = true; moved = true; host.dataset.dragging = 'true';
    placeCharacter(drag.left + dx, drag.top + dy);
  });
  function endDrag() {
    if (drag) { suppressClick = drag.moved; if (figure.hasPointerCapture(drag.id)) figure.releasePointerCapture(drag.id); }
    drag = null; delete host.dataset.dragging;
  }
  figure.addEventListener('pointerup', endDrag); figure.addEventListener('pointercancel', endDrag);
  figure.addEventListener('lostpointercapture', endDrag);
  titleBar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    chatDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    titleBar.setPointerCapture(event.pointerId);
  });
  titleBar.addEventListener('pointermove', event => {
    if (!chatDrag || event.pointerId !== chatDrag.id) return;
    const dx = event.clientX - chatDrag.x, dy = event.clientY - chatDrag.y;
    if (!panel.dataset.dragging && Math.hypot(dx, dy) < 4) return;
    panel.dataset.dragging = 'true';
    chatPosition = { left: chatDrag.left + dx, top: chatDrag.top + dy }; positionChat();
  });
  function endChatDrag() {
    const previous = chatDrag; chatDrag = null;
    if (previous && titleBar.hasPointerCapture(previous.id)) titleBar.releasePointerCapture(previous.id);
    delete panel.dataset.dragging;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) titleBar.addEventListener(type, endChatDrag);
  // Input stays local: no equipment selection, camera wheel, or editor shortcuts.
  for (const surface of [layer, host, panel]) {
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(type => {
      surface.addEventListener(type, event => event.stopPropagation());
    });
    surface.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closeChat(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
    });
    surface.addEventListener('keyup', event => event.stopPropagation());
  }
  window.addEventListener('pointermove', event => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true; }, true);
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
  window.addEventListener('blur', () => { pointer.active = false; endDrag(); endChatDrag(); });
  function syncMode() {
    layer.hidden = root.FEMSWorkspaceMode?.mode !== 'monitoring';
    if (layer.hidden) {
      endDrag(); setVisible(false);
      if (replyTimer !== null) window.clearTimeout(replyTimer);
      replyTimer = null; pending?.remove(); pending = null;
      messages.setAttribute('aria-busy', 'false'); updateSendButton();
    }
  }
  window.addEventListener('fems-workspace-mode-change', syncMode);
  window.addEventListener('fems-language-change', positionChat);
  function clampFloatingUI() {
    if (host.hidden || layer.hidden) return;
    const box = localCharacter(); placeCharacter(box.left, box.top);
  }
  window.addEventListener('resize', clampFloatingUI);
  new ResizeObserver(clampFloatingUI).observe(viewport);
  syncMode();
  // The original SVG is inline so local preview and static hosting use identical assets.
  restartAnimation = animateCompanion();

  function animateCompanion() {
  const gaze = host.querySelector('#companion-gaze');
  const rightEye = host.querySelector('#companion-right-eye');
  const mouth = host.querySelector('#companion-mouth');
  const eyes = host.querySelectorAll('.companion-eye');
  if (!gaze || !rightEye || !mouth || eyes.length !== 2) return () => {};

  // 정면과 상하좌우, 대각선 방향을 순회합니다.
  const directions = [
    [0, 0], [-0.8, -0.65], [0, -1], [0.9, -0.5],
    [1, 0], [0.65, 0.7], [0, 1], [-0.9, 0.6], [-1, 0],
  ];
  const position = { x: 0, y: 0 };
  let frame = 0;
  let previousTime = 0;
  let lastDirection = -1;
  let target = directions[0];
  let nextDirectionAt = 0;
  let nextBlinkAt = performance.now() + 3200;
  let blinkStart = -Infinity;

  function draw(x, y, eyeHeight = 1) {
    // OpenPencil의 정면·좌·우·상·하 시선 좌표를 섞어 대각선에서도 부드럽게 움직입니다.
    const total = Math.max(1, Math.abs(x) + Math.abs(y));
    const left = Math.max(0, -x) / total;
    const right = Math.max(0, x) / total;
    const up = Math.max(0, -y) / total;
    const down = Math.max(0, y) / total;
    gaze.setAttribute('transform', `translate(${(214 - 86 * left + 162 * right).toFixed(2)}, ${(358.14 - 83 * up + 138 * down).toFixed(2)})`);
    rightEye.setAttribute('transform', `translate(${(265 - 59 * left - 55 * right).toFixed(2)}, 0)`);
    mouth.setAttribute('transform', `translate(${(122.52 - 49.52 * left - 20.52 * right).toFixed(2)}, ${(156.37 + 2.63 * right + 4.63 * up - 54.37 * down).toFixed(2)})`);
    const verticalEyeScale = eyeHeight * (1 - 18 / 138 * down);
    eyes[0].style.transform = `scale(${(1 - 20 / 86 * left).toFixed(3)}, ${verticalEyeScale.toFixed(3)})`;
    eyes[1].style.transform = `scale(${(1 - 20 / 86 * right).toFixed(3)}, ${verticalEyeScale.toFixed(3)})`;
  }

  function tick(now) {
    if (reducedMotion.matches || document.hidden || host.hidden) {
      frame = 0;
      draw(0, 0);
      return;
    }

    const elapsed = Math.min(64, Math.max(0, now - (previousTime || now)));
    previousTime = now;
    if (now >= nextDirectionAt) {
      lastDirection = (lastDirection + 1) % directions.length;
      target = directions[lastDirection];
      nextDirectionAt = now + 2200;
    }

    const rect = host.getBoundingClientRect();
    const dx = pointer.x - (rect.left + rect.width / 2);
    const dy = pointer.y - (rect.top + rect.height * 0.45);
    const distance = Math.hypot(dx, dy);
    const strength = Math.min(1, distance / 85);
    const goalX = pointer.active ? dx / (distance || 1) * strength : target[0];
    const goalY = pointer.active ? dy / (distance || 1) * strength : target[1];
    const ease = 1 - Math.exp(-elapsed / 300);
    position.x += (goalX - position.x) * ease;
    position.y += (goalY - position.y) * ease;

    if (now >= nextBlinkAt) {
      blinkStart = now;
      nextBlinkAt = now + 3300 + Math.random() * 1800;
    }
    const blinkPhase = (now - blinkStart) / 170;
    const eyeHeight = blinkPhase >= 0 && blinkPhase <= 1
      ? 1 - 0.91 * Math.sin(Math.PI * blinkPhase)
      : 1;
    draw(position.x, position.y, eyeHeight);
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (reducedMotion.matches || document.hidden || host.hidden) {
      draw(0, 0);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  reducedMotion.addEventListener('change', start);
  document.addEventListener('visibilitychange', start);
  start();
  return start;
}

})(typeof window === 'undefined' ? globalThis : window);
