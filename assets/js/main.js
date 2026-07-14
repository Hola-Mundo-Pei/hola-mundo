// main.js
// Lógica compartida entre páginas.
//
// Arquitectura de "ventanas" (Opción C: fetch + inyección):
// - index.html tiene un contenedor #window-overlay (oculto por defecto).
// - Al hacer clic en cualquier elemento con [data-window="archivo.html"],
//   se descarga ese archivo, se extrae solo su .window (sin <head>,
//   <body>, etc.) y se inyecta dentro del overlay con una animación
//   de fade + escala.
// - SOLO se cierra con los botones "Minimizar" o "Cerrar ventana" de la
//   barra de título (NO con Escape ni haciendo clic afuera).
// - El botón "Maximizar" expande la ventana para ocupar todo el espacio
//   debajo del navbar amarillo (que se mantiene siempre visible).
//
// Esta lógica SOLO se activa si existe #window-overlay en la página
// (es decir, solo en index.html). Si el archivo se abre standalone
// (ej. abrir que-es.html directo en el navegador para probarlo), este
// script no hace nada y los enlaces funcionan como navegación normal.

(function () {
  const overlay = document.getElementById('window-overlay');
  const slot = document.getElementById('window-overlay-slot');

  if (!overlay || !slot) {
    // Estamos en una página standalone (no en index.html) — no hacemos nada.
    return;
  }

  // Duración de la animación de salida — debe coincidir con la transición
  // definida en window.css (.window-overlay { transition: ... }).
  const CLOSE_ANIMATION_MS = 250;
  let closeTimer = null;

  // El navbar amarillo mide distinto según el tamaño de pantalla (puede
  // hacer wrap en móvil) y también cambia una vez cargan sus imágenes
  // (logo, etc.), que al principio pueden hacerlo más bajo de lo que
  // termina siendo. Usamos ResizeObserver para que --header-height
  // siempre quede sincronizado con el alto real, sin importar cuándo
  // cambie.
  function updateHeaderHeightVar() {
    const header = document.querySelector('.site-header');
    if (header) {
      document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    }
  }

  // El navbar vive en partials/navbar.html (ver ese archivo) y se inyecta
  // dentro de #navbar-slot. Recién cuando termina de inyectarse podemos
  // medir su alto real y empezar a observarlo.
  async function loadNavbar() {
    const navbarSlot = document.getElementById('navbar-slot');
    if (!navbarSlot) return;

    try {
      const res = await fetch('partials/navbar.html');
      if (!res.ok) throw new Error('No se pudo cargar partials/navbar.html');

      navbarSlot.innerHTML = await res.text();

      updateHeaderHeightVar();
      const headerEl = document.querySelector('.site-header');
      if (headerEl && 'ResizeObserver' in window) {
        new ResizeObserver(updateHeaderHeightVar).observe(headerEl);
      }
    } catch (err) {
      console.error('[Hola Mundo] Error cargando el navbar:', err);
    }
  }

  loadNavbar();
  window.addEventListener('load', updateHeaderHeightVar);
  window.addEventListener('resize', updateHeaderHeightVar);

  async function openWindow(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo cargar ' + url);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const windowEl = doc.querySelector('.window');

      if (!windowEl) {
        throw new Error('No se encontró .window dentro de ' + url);
      }

      window.clearTimeout(closeTimer);

      slot.innerHTML = '';
      slot.appendChild(windowEl);
      overlay.classList.remove('is-maximized');
      overlay.hidden = false;

      // Forzamos reflow antes de agregar la clase, para que la transición
      // de entrada (fade + escala) sí se dispare en vez de saltar directo
      // al estado final.
      void overlay.offsetWidth;
      overlay.classList.add('is-open');

      document.body.style.overflow = 'hidden';

      windowEl.setAttribute('tabindex', '-1');
      windowEl.focus({ preventScroll: true });

    } catch (err) {
      console.error('[Hola Mundo] Error abriendo ventana:', err);
    }
  }

  function closeWindow() {
    overlay.classList.remove('is-open');
    overlay.classList.remove('is-maximized');
    document.body.style.overflow = '';

    // Esperamos a que termine la animación de salida antes de vaciar
    // el contenido y ocultar el overlay del todo.
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () {
      overlay.hidden = true;
      slot.innerHTML = '';
    }, CLOSE_ANIMATION_MS);
  }

  function toggleMaximize() {
    overlay.classList.toggle('is-maximized');
  }

  document.addEventListener('click', function (e) {
    // 1) Clic en un enlace/botón que abre una ventana
    const trigger = e.target.closest('[data-window]');
    if (trigger) {
      e.preventDefault();
      openWindow(trigger.getAttribute('data-window'));
      return;
    }

    // 2) Minimizar o Cerrar ventana → cierran
    const closeBtn = e.target.closest('.window__action-btn[aria-label="Minimizar"], .window__action-btn[aria-label="Cerrar ventana"]');
    if (closeBtn && overlay.contains(closeBtn)) {
      e.preventDefault();
      closeWindow();
      return;
    }

    // 3) Maximizar → expande/restaura, no cierra
    const maxBtn = e.target.closest('.window__action-btn[aria-label="Maximizar"]');
    if (maxBtn && overlay.contains(maxBtn)) {
      e.preventDefault();
      toggleMaximize();
      return;
    }

    // NOTA: a propósito NO hay cierre por clic afuera de la ventana.
  });

  // NOTA: a propósito NO hay cierre con la tecla Escape.
})();


// =================================================================
// Lógica de la página "Fotos": selección de sesión + navegación de fotos
// =================================================================
//
// A propósito esto va FUERA del bloque de arriba (que solo corre si existe
// #window-overlay): esta lógica debe funcionar tanto si fotos.html se abre
// standalone (probándola directo en el navegador) como si se inyecta
// dentro del overlay de index.html. Por eso usa un MutationObserver que
// detecta cuándo aparece .fotos-player en el DOM, sin importar cómo llegó
// ahí.
//
// CÓMO FUNCIONA LA DETECCIÓN DE FOTOS POR SESIÓN:
// Como esto es un sitio estático (sin backend), el navegador no puede
// "listar" los archivos de una carpeta. En vez de eso, probamos cargar
// 01.jpg, 02.jpg, 03.jpg... de la carpeta de cada sesión hasta que uno
// falla, y ahí paramos. Por eso las fotos de cada sesión DEBEN:
//   - Llamarse 01.jpg, 02.jpg, 03.jpg... (dos dígitos, sin saltos)
//   - Estar en assets/img/fotos-sesiones/<número de sesión>/
// Si por ejemplo subes 01.jpg y 03.jpg pero falta 02.jpg, la detección
// se va a detener en la sesión 1 y nunca va a "ver" la 03 — hay que
// numerarlas sin huecos.

(function () {
  const photoCache = {}; // { "1": ["assets/.../01.jpg", ...], "2": [...] }
  const MAX_PHOTOS_PER_SESSION = 40; // tope de intentos, ajustable

  let currentSessionId = null;
  let currentPhotos = [];
  let currentIndex = 0;

  // SVG inline como placeholder cuando una sesión todavía no tiene fotos
  // subidas — no depende de ningún archivo de imagen.
  const NO_PHOTOS_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
    '<rect width="400" height="400" fill="#1a1a18"/>' +
    '<text x="50%" y="50%" fill="#9ea096" font-family="Arial, sans-serif" ' +
    'font-size="18" text-anchor="middle" dominant-baseline="middle">Fotos próximamente</text>' +
    '</svg>'
  );

  function imageExists(url) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () { resolve(true); };
      img.onerror = function () { resolve(false); };
      img.src = url;
    });
  }

  async function getSessionPhotos(sessionId) {
    if (photoCache[sessionId]) return photoCache[sessionId];

    // Las carpetas en assets/img/fotos-sesiones/ usan 2 dígitos (01, 02...),
    // pero data-cassette="1" en el HTML no trae el cero a la izquierda —
    // hay que agregarlo antes de armar la ruta.
    const folderId = String(sessionId).padStart(2, '0');

    const photos = [];
    for (let i = 1; i <= MAX_PHOTOS_PER_SESSION; i++) {
      const num = String(i).padStart(2, '0');
      const url = 'assets/img/fotos-sesiones/' + folderId + '/' + num + '.jpg';
      const exists = await imageExists(url);
      if (!exists) break;
      photos.push(url);
    }

    photoCache[sessionId] = photos;
    return photos;
  }

  function renderCurrentPhoto() {
    const photoEl = document.getElementById('fotos-current-photo');
    if (!photoEl) return;

    if (currentPhotos.length === 0) {
      photoEl.src = NO_PHOTOS_PLACEHOLDER;
      photoEl.alt = 'Aún no hay fotos para esta sesión';
      return;
    }

    photoEl.src = currentPhotos[currentIndex];
    photoEl.alt = 'Foto ' + (currentIndex + 1) + ' de ' + currentPhotos.length;
  }

  async function selectSession(sessionId, sourceButton) {
    // Estado visual: marcar la fila clickeada como activa, desmarcar las demás
    document.querySelectorAll('.fotos-tv__tray--compact').forEach(function (tray) {
      tray.classList.remove('is-active');
    });
    document.querySelectorAll('.cassette-list .fotos-control[data-cassette]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', 'false');
    });

    const tray = sourceButton.closest('.fotos-tv__tray--compact');
    if (tray) tray.classList.add('is-active');
    sourceButton.setAttribute('aria-pressed', 'true');

    // El número y la etiqueta de la bandeja del TV se leen de la fila
    // clickeada (una sola fuente de verdad: el HTML de la lista).
    const numberEl = tray ? tray.querySelector('.cassette-item__number') : null;
    const labelEl = tray ? tray.querySelector('.fotos-tv__slot-label') : null;

    const numberTarget = document.getElementById('fotos-current-number');
    const labelTarget = document.getElementById('fotos-current-label');
    if (numberTarget && numberEl) numberTarget.textContent = numberEl.textContent.trim();
    if (labelTarget && labelEl) labelTarget.textContent = labelEl.textContent.trim();

    currentSessionId = sessionId;
    currentIndex = 0;
    currentPhotos = await getSessionPhotos(sessionId);
    renderCurrentPhoto();
  }

  function stepPhoto(direction) {
    if (currentPhotos.length === 0) return;
    // Con wraparound: pasar la última foto vuelve a la primera, y viceversa.
    currentIndex = (currentIndex + direction + currentPhotos.length) % currentPhotos.length;
    renderCurrentPhoto();
  }

  // Al aparecer la página de Fotos (standalone o inyectada), selecciona
  // automáticamente la primera sesión.
  function initFotos(root) {
    const firstBtn = root.querySelector('.cassette-list .fotos-control[data-cassette]');
    if (firstBtn) selectSession(firstBtn.getAttribute('data-cassette'), firstBtn);
  }

  // Caso 1: fotos.html ya está en el DOM al cargar el script (standalone)
  if (document.querySelector('.fotos-player')) {
    initFotos(document);
  }

  // Caso 2: fotos.html se inyecta más tarde dentro del overlay de index.html
  new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const player = node.classList && node.classList.contains('fotos-player')
          ? node
          : node.querySelector && node.querySelector('.fotos-player');
        if (player) {
          initFotos(document);
          return;
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Clics: seleccionar sesión + navegar fotos (delegación de eventos,
  // funciona sin importar cuándo se haya inyectado el contenido)
  document.addEventListener('click', function (e) {
    const cassetteBtn = e.target.closest('.cassette-list .fotos-control[data-cassette]');
    if (cassetteBtn) {
      e.preventDefault();
      selectSession(cassetteBtn.getAttribute('data-cassette'), cassetteBtn);
      return;
    }

    if (e.target.closest('#fotos-prev')) {
      e.preventDefault();
      stepPhoto(-1);
      return;
    }

    if (e.target.closest('#fotos-next')) {
      e.preventDefault();
      stepPhoto(1);
      return;
    }

    // NOTA: el botón decorativo del medio (■) a propósito no tiene handler.
  });
})();