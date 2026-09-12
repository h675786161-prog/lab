(() => {
  const SELECTOR = '[data-f7d-choice="1"]';

  function refill(button) {
    const textarea = document.querySelector('#send_textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const text = String(button.textContent || '').trim();
    if (!text) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    refill(button);
  });

  window.__F7D_CHOICE_BRIDGE__ = { loaded: true, selector: SELECTOR };
})();
