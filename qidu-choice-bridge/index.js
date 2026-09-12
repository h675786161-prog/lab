(() => {
  const BRIDGE_KEY = '__QIDU_CHOICE_BRIDGE__';
  const CHOICE_SELECTOR = '[data-f7d-choice="1"]';
  const VERSION = '1.0.0';

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

    // Keep the user in control: fill the composer, never auto-send.
    focusTextarea(textarea);
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

  const install = () => {
    const previous = window[BRIDGE_KEY];
    if (previous?.handler instanceof Function) {
      document.removeEventListener('click', previous.handler, true);
    }

    document.addEventListener('click', onChoiceClick, true);
    window[BRIDGE_KEY] = {
      loaded: true,
      loadedAt: new Date().toISOString(),
      version: VERSION,
      selector: CHOICE_SELECTOR,
      handler: onChoiceClick,
      refillChoice,
      autoSend: false,
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
