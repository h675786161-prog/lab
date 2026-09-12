(() => {
  const CHOICE_SELECTOR = '[data-f7d-choice="1"]';

  const focusTextarea = (textarea) => {
    try { textarea.focus({ preventScroll: true }); } catch { textarea.focus(); }
  };

  const refillChoice = (button) => {
    const textarea = document.querySelector('#send_textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) return false;

    const value = String(button?.textContent || '').trim();
    if (!value) return false;

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(textarea, value);
    else textarea.value = value;

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    focusTextarea(textarea);

    // SillyTavern and the browser may restore focus to the clicked button after the
    // bubbling phase. Re-assert focus after all competing click handlers complete.
    queueMicrotask(() => focusTextarea(textarea));
    requestAnimationFrame(() => focusTextarea(textarea));
    setTimeout(() => focusTextarea(textarea), 0);
    return true;
  };

  const onChoiceClick = (event) => {
    const target = event.target instanceof Element ? event.target.closest(CHOICE_SELECTOR) : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    refillChoice(target);
  };

  const installProbe = () => {
    window.__LINGQI_LAB_PROBE__ = {
      loaded: true,
      loadedAt: new Date().toISOString(),
      qiduChoiceBridge: true,
      choiceSelector: CHOICE_SELECTOR,
      choiceBridgeVersion: '0.1.1',
    };

    if (!document.getElementById('lingqi-lab-probe')) {
      const marker = document.createElement('div');
      marker.id = 'lingqi-lab-probe';
      marker.hidden = true;
      marker.dataset.loaded = 'true';
      marker.dataset.qiduChoiceBridge = 'true';
      document.body.appendChild(marker);
    }

    document.removeEventListener('click', onChoiceClick, true);
    document.addEventListener('click', onChoiceClick, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installProbe, { once: true });
  } else {
    installProbe();
  }
})();
