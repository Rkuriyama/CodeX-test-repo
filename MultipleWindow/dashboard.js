const columnsContainer = document.getElementById('columns');
const addForm = document.getElementById('add-column-form');
const urlInput = document.getElementById('url-input');
const widthInput = document.getElementById('width-input');
const columnTemplate = document.getElementById('column-template');

let columnsState = [];

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

const renderColumns = () => {
  columnsContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();

  columnsState.forEach((column) => {
    const columnElement = columnTemplate.content.firstElementChild.cloneNode(true);
    const navigationForm = columnElement.querySelector('.navigation-form');
    const addressInput = columnElement.querySelector('.address-input');
    const iframe = columnElement.querySelector('.column-frame');
    const widthSlider = columnElement.querySelector('.width-slider');
    const widthValue = columnElement.querySelector('.width-value');
    const removeButton = columnElement.querySelector('.remove-column');

    const effectiveWidth = column.width ?? 30;
    columnElement.style.flex = `0 0 ${effectiveWidth}%`;
    columnElement.style.width = `${effectiveWidth}%`;
    widthSlider.value = effectiveWidth;
    widthValue.textContent = `${effectiveWidth}%`;

    addressInput.value = column.url;
    iframe.src = column.url;

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
      iframe.src = nextUrl;
      await persistColumns();
    });

    addressInput.addEventListener('input', () => {
      addressInput.classList.remove('input-error');
      clearInputError(addressInput);
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

loadColumns();
