import './x-frame-bypass.js';

const columnsContainer = document.getElementById('columns');
const addForm = document.getElementById('add-column-form');
const urlInput = document.getElementById('url-input');
const widthInput = document.getElementById('width-input');
const columnTemplate = document.getElementById('column-template');

let columnsState = [];
const columnViews = new Map();
let currentTabId = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeUrl = (rawUrl) => {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).toString();
  } catch (error) {
    return null;
  }
};

const normalizeAbsoluteUrl = (rawUrl) => {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).toString();
  } catch (error) {
    return null;
  }
};

const extractHostname = (rawUrl) => {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname || rawUrl;
  } catch (error) {
    return rawUrl;
  }
};

const registerDashboard = () =>
  new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      resolve(null);
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'registerDashboard' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const tabId = typeof response?.tabId === 'number' ? response.tabId : null;
        currentTabId = tabId;
        resolve(tabId);
      });
    } catch (error) {
      resolve(null);
    }
  });

const persistColumns = async () => {
  await chrome.storage.local.set({ columns: columnsState });
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `col-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const setInputError = (input, message) => {
  if (input && typeof input.setCustomValidity === 'function') {
    input.setCustomValidity(message);
    input.reportValidity();
  }
};

const clearInputError = (input) => {
  if (input && typeof input.setCustomValidity === 'function') {
    input.setCustomValidity('');
  }
};

const getColumnView = (columnId) => columnViews.get(columnId);

const showLoadingOverlay = (columnId, targetUrl) => {
  const view = getColumnView(columnId);
  if (!view) return;
  view.currentUrl = targetUrl ?? view.currentUrl;
  view.overlay.hidden = false;
  view.overlay.dataset.state = 'loading';
  view.overlay.classList.remove('is-error');
  view.overlayTitle.textContent = '読み込み中...';
  view.overlayMessage.textContent = 'ページを読み込んでいます。';
  view.overlayDetail.textContent = '';
  view.overlayDetail.hidden = true;
  view.overlayActions.hidden = true;
  view.overlayAction.hidden = true;
  if (view.addressInput) {
    view.addressInput.classList.remove('input-error');
    clearInputError(view.addressInput);
  }
};

const showBlockedOverlay = (columnId, targetUrl, reason) => {
  const view = getColumnView(columnId);
  if (!view) return;
  const normalizedTarget = normalizeAbsoluteUrl(targetUrl) ?? view.currentUrl ?? view.iframe?.src;
  view.currentUrl = normalizedTarget ?? view.currentUrl;
  const hostname = extractHostname(normalizedTarget ?? '');
  view.overlay.hidden = false;
  view.overlay.dataset.state = 'blocked';
  view.overlay.classList.add('is-error');
  view.overlayTitle.textContent = 'ページを表示できません';
  view.overlayMessage.textContent = `${hostname} は iframe での表示を許可していない可能性があります。`;
  if (reason) {
    view.overlayDetail.textContent = `理由: ${reason}`;
    view.overlayDetail.hidden = false;
  } else {
    view.overlayDetail.textContent = '';
    view.overlayDetail.hidden = true;
  }
  view.overlayActions.hidden = false;
  view.overlayAction.hidden = false;
  if (view.addressInput) {
    view.addressInput.classList.add('input-error');
    setInputError(view.addressInput, 'このサイトは iframe での表示を許可していません');
  }
};

const hideOverlay = (columnId) => {
  const view = getColumnView(columnId);
  if (!view) return;
  if (view.overlay.dataset.state === 'blocked') {
    return;
  }
  view.overlay.hidden = true;
  view.overlay.dataset.state = 'ready';
  view.overlay.classList.remove('is-error');
};

const setFrameSource = (columnId, targetUrl) => {
  if (!targetUrl) return;
  const view = getColumnView(columnId);
  if (!view) return;
  view.currentUrl = targetUrl;
  showLoadingOverlay(columnId, targetUrl);
  if (typeof view.iframe?.load === 'function') {
    view.iframe.load(targetUrl);
  } else {
    view.iframe.src = targetUrl;
  }
};

const renderColumns = () => {
  columnsContainer.innerHTML = '';
  columnViews.clear();
  const fragment = document.createDocumentFragment();

  columnsState.forEach((column) => {
    const columnElement = columnTemplate.content.firstElementChild.cloneNode(true);
    const navigationForm = columnElement.querySelector('.navigation-form');
    const addressInput = columnElement.querySelector('.address-input');
    const iframe = columnElement.querySelector('.column-frame');
    const widthSlider = columnElement.querySelector('.width-slider');
    const widthValue = columnElement.querySelector('.width-value');
    const removeButton = columnElement.querySelector('.remove-column');
    const overlay = columnElement.querySelector('.frame-overlay');
    const overlayTitle = overlay.querySelector('.overlay-title');
    const overlayMessage = overlay.querySelector('.overlay-message');
    const overlayDetail = overlay.querySelector('.overlay-detail');
    const overlayActions = overlay.querySelector('.overlay-actions');
    const overlayAction = overlay.querySelector('.overlay-action');

    const view = {
      columnElement,
      iframe,
      overlay,
      overlayTitle,
      overlayMessage,
      overlayDetail,
      overlayActions,
      overlayAction,
      addressInput,
      currentUrl: column.url
    };

    columnViews.set(column.id, view);

    const effectiveWidth = column.width ?? 30;
    columnElement.style.flex = `0 0 ${effectiveWidth}%`;
    columnElement.style.width = `${effectiveWidth}%`;
    widthSlider.value = effectiveWidth;
    widthValue.textContent = `${effectiveWidth}%`;

    addressInput.value = column.url;

    overlayAction.addEventListener('click', () => {
      const target = view.currentUrl ?? column.url;
      if (!target || !chrome?.tabs?.create) {
        return;
      }
      try {
        chrome.tabs.create({ url: target });
      } catch (error) {
        // ignore
      }
    });

    navigationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nextUrl = normalizeUrl(addressInput.value);
      if (!nextUrl) {
        addressInput.classList.add('input-error');
        setInputError(addressInput, '有効なURLを入力してください');
        return;
      }
      addressInput.classList.remove('input-error');
      clearInputError(addressInput);
      column.url = nextUrl;
      addressInput.value = nextUrl;
      setFrameSource(column.id, nextUrl);
      await persistColumns();
    });

    addressInput.addEventListener('input', () => {
      addressInput.classList.remove('input-error');
      clearInputError(addressInput);
    });

    iframe.addEventListener('xbypass:loading', (event) => {
      const target = normalizeAbsoluteUrl(event?.detail?.url) ?? event?.detail?.url;
      showLoadingOverlay(column.id, target ?? column.url);
    });

    iframe.addEventListener('xbypass:load', async (event) => {
      const loadedUrl = normalizeAbsoluteUrl(event?.detail?.url) ?? column.url;
      let shouldPersist = false;
      if (loadedUrl) {
        view.currentUrl = loadedUrl;
        const previousUrl = column.url;
        column.url = loadedUrl;
        addressInput.value = loadedUrl;
        addressInput.classList.remove('input-error');
        clearInputError(addressInput);
        shouldPersist = loadedUrl !== previousUrl;
      }
      hideOverlay(column.id);
      if (shouldPersist) {
        await persistColumns();
      }
    });

    iframe.addEventListener('xbypass:error', (event) => {
      const failingUrl = normalizeAbsoluteUrl(event?.detail?.url) ?? view.currentUrl ?? column.url;
      const reason = event?.detail?.message ?? 'ページを読み込めませんでした。';
      showBlockedOverlay(column.id, failingUrl, reason);
    });

    iframe.addEventListener('load', () => {
      if (iframe.getAttribute('is') !== 'x-frame-bypass') {
        view.currentUrl = iframe?.src ?? view.currentUrl;
      }
      hideOverlay(column.id);
    });

    iframe.addEventListener('error', () => {
      const failingUrl = iframe?.src || view.currentUrl || column.url;
      showBlockedOverlay(column.id, failingUrl, 'ページを読み込めませんでした。');
    });

    widthSlider.addEventListener('input', () => {
      const value = parseInt(widthSlider.value, 10);
      widthValue.textContent = `${value}%`;
      columnElement.style.flex = `0 0 ${value}%`;
      columnElement.style.width = `${value}%`;
    });

    widthSlider.addEventListener('change', async () => {
      const updatedWidth = parseInt(widthSlider.value, 10);
      column.width = clamp(updatedWidth, 10, 100);
      widthSlider.value = column.width;
      widthValue.textContent = `${column.width}%`;
      columnElement.style.flex = `0 0 ${column.width}%`;
      columnElement.style.width = `${column.width}%`;
      await persistColumns();
    });

    removeButton.addEventListener('click', async () => {
      columnsState = columnsState.filter((item) => item.id !== column.id);
      await persistColumns();
      renderColumns();
    });

    setFrameSource(column.id, column.url);

    fragment.appendChild(columnElement);
  });

  columnsContainer.appendChild(fragment);
};

const loadColumns = async () => {
  const stored = await chrome.storage.local.get({ columns: [] });
  if (Array.isArray(stored.columns)) {
    columnsState = stored.columns;
  } else {
    columnsState = [];
  }
  renderColumns();
};

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const normalizedUrl = normalizeUrl(urlInput.value);
  if (!normalizedUrl) {
    urlInput.classList.add('input-error');
    setInputError(urlInput, '有効なURLを入力してください');
    return;
  }
  urlInput.classList.remove('input-error');
  clearInputError(urlInput);

  const widthValue = parseInt(widthInput.value, 10);
  const column = {
    id: createId(),
    url: normalizedUrl,
    width: clamp(Number.isFinite(widthValue) ? widthValue : 30, 10, 100)
  };

  columnsState.push(column);
  await persistColumns();
  renderColumns();

  urlInput.value = '';
});

urlInput.addEventListener('input', () => {
  urlInput.classList.remove('input-error');
  clearInputError(urlInput);
});

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'frameBlocked') {
      return;
    }
    if (message.tabId && currentTabId && message.tabId !== currentTabId) {
      return;
    }

    const normalizedTarget = normalizeAbsoluteUrl(message.url);
    if (!normalizedTarget) {
      return;
    }

    let handled = false;
    columnViews.forEach((view, columnId) => {
      const iframeUrl = normalizeAbsoluteUrl(view.iframe?.src);
      const columnData = columnsState.find((item) => item.id === columnId);
      const columnUrl = normalizeAbsoluteUrl(columnData?.url);
      if (iframeUrl === normalizedTarget || columnUrl === normalizedTarget) {
        showBlockedOverlay(columnId, normalizedTarget, message.reason);
        handled = true;
      }
    });

    if (!handled) {
      const targetHost = extractHostname(normalizedTarget);
      columnViews.forEach((_view, columnId) => {
        if (handled) return;
        const candidateView = getColumnView(columnId);
        const iframeHost = extractHostname(candidateView?.iframe?.src ?? '');
        if (iframeHost && iframeHost === targetHost) {
          showBlockedOverlay(columnId, normalizedTarget, message.reason);
          handled = true;
        }
      });
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (!chrome?.runtime?.sendMessage) {
    return;
  }
  try {
    chrome.runtime.sendMessage({ type: 'unregisterDashboard', tabId: currentTabId ?? undefined });
  } catch (error) {
    // ignore
  }
});

const init = async () => {
  await registerDashboard();
  await loadColumns();
};

init();
