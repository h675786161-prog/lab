(() => {
  const installProbe = () => {
    window.__LINGQI_LAB_PROBE__ = {
      loaded: true,
      loadedAt: new Date().toISOString(),
    };

    if (!document.getElementById('lingqi-lab-probe')) {
      const marker = document.createElement('div');
      marker.id = 'lingqi-lab-probe';
      marker.hidden = true;
      marker.dataset.loaded = 'true';
      document.body.appendChild(marker);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installProbe, { once: true });
  } else {
    installProbe();
  }
})();
