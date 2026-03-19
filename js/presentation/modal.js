// Presentation: Modal + sidebar + keyboard shortcuts

export function openModal(id) { document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }
export function openCommandLog() { openModal('cmdLogModal'); }
export function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

export function setupModalListeners() {
  // Click outside modal to close
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
    }
  });
}

// Expose to window for inline onclick handlers in HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.openCommandLog = openCommandLog;
window.toggleSidebar = toggleSidebar;
