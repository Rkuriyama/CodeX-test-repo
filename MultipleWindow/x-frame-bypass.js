const DEFAULT_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy/?quest=',
  'https://cors.isomorphic-git.org/'
];

const LOADER_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #fff;
      }
      .loader {
        position: absolute;
        top: calc(50% - 25px);
        left: calc(50% - 25px);
        width: 50px;
        height: 50px;
        background-color: #333;
        border-radius: 50%;
        animation: loader 1s infinite ease-in-out;
      }
      @keyframes loader {
        0% {
          transform: scale(0);
        }
        100% {
          transform: scale(1);
          opacity: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="loader"></div>
  </body>
</html>`;

const NAVIGATION_HELPER = `
  <base href="__BASE_URL__">
  <script>
    const toAbsoluteUrl = (value) => {
      try {
        return new URL(value, document.baseURI).toString();
      } catch (error) {
        return value;
      }
    };

    document.addEventListener('click', (event) => {
      if (!frameElement) {
        return;
      }
      const anchor = event.target?.closest('a[href]');
      if (!anchor) {
        return;
      }
      const targetAttr = anchor.getAttribute('target');
      if (targetAttr && targetAttr.toLowerCase() === '_blank') {
        return;
      }
      event.preventDefault();
      frameElement.load(toAbsoluteUrl(anchor.href));
    });

    document.addEventListener('submit', (event) => {
      if (!frameElement) {
        return;
      }
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }
      event.preventDefault();
      const method = (form.method || 'get').toLowerCase();
      const action = toAbsoluteUrl(form.action || document.baseURI);
      if (method === 'post') {
        const formData = new FormData(form);
        frameElement.load(action, { method: 'post', body: formData });
        return;
      }
      const params = new URLSearchParams(new FormData(form));
      const url = new URL(action);
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      frameElement.load(url.toString());
    });
  </script>
`.trim();

class XFrameBypassElement extends HTMLIFrameElement {
  static get observedAttributes() {
    return ['src'];
  }

  constructor() {
    super();
    this._currentUrl = null;
    this._proxies = DEFAULT_PROXIES.slice();
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'src' && newValue) {
      this.load(newValue);
    }
  }

  connectedCallback() {
    if (!this.hasAttribute('sandbox')) {
      this.sandbox =
        'allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation';
    }
  }

  set proxies(list) {
    if (Array.isArray(list) && list.length > 0) {
      this._proxies = list.slice();
    }
  }

  get proxies() {
    return this._proxies.slice();
  }

  load(url, options = {}) {
    if (!url) {
      return;
    }
    const normalizedUrl = this._normalizeUrl(url);
    this._currentUrl = normalizedUrl;
    this.dispatchEvent(
      new CustomEvent('xbypass:loading', { detail: { url: normalizedUrl }, bubbles: true })
    );
    this.srcdoc = LOADER_HTML;

    this._fetchThroughProxy(normalizedUrl, options, 0)
      .then((response) => response.text())
      .then((html) => {
        const processed = this._injectHelpers(html, normalizedUrl);
        this.srcdoc = processed;
        this.dispatchEvent(
          new CustomEvent('xbypass:load', { detail: { url: normalizedUrl }, bubbles: true })
        );
      })
      .catch((error) => {
        console.error('Cannot load X-Frame-Bypass:', error);
        const message = error instanceof Error ? error.message : String(error);
        this.srcdoc = this._renderError(normalizedUrl, message);
        this.dispatchEvent(
          new CustomEvent('xbypass:error', {
            detail: { url: normalizedUrl, message },
            bubbles: true
          })
        );
      });
  }

  _normalizeUrl(url) {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    throw new Error(`X-Frame-Bypass src ${url} does not start with http(s)://`);
  }

  _injectHelpers(html, url) {
    if (!html) {
      return this._renderError(url, 'Empty response from proxy');
    }
    const helperMarkup = NAVIGATION_HELPER.replace('__BASE_URL__', this._escapeAttribute(url));
    let content = html;
    if (/<head([^>]*)>/i.test(content)) {
      content = content.replace(/<head([^>]*)>/i, (match, attrs) => `<head${attrs || ''}>\n${helperMarkup}`);
    } else {
      content = `<head>${helperMarkup}</head>${content}`;
    }
    const withoutCsp = content
      .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
      .replace(/<meta[^>]+content=["'][^"']*frame-ancestors[^"']*["'][^>]*>/gi, '');
    return withoutCsp.replace(/ crossorigin=['"][^'"]*['"]/gi, '');
  }

  _renderError(url, message) {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        padding: 32px;
        color: #222;
        background: #fafafa;
      }
      h1 {
        font-size: 18px;
        margin-bottom: 12px;
      }
      p {
        margin: 0 0 8px 0;
        line-height: 1.4;
      }
      code {
        display: inline-block;
        padding: 2px 4px;
        background: rgba(0,0,0,0.06);
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <h1>ページを読み込めません</h1>
    <p><strong>URL:</strong> <code>${this._escapeHtml(url)}</code></p>
    <p><strong>理由:</strong> ${this._escapeHtml(message)}</p>
  </body>
</html>`;
  }

  _escapeAttribute(value) {
    return String(value).replace(/"/g, '&quot;');
  }

  _escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _fetchThroughProxy(url, options, index) {
    const proxies = this._proxies;
    if (!Array.isArray(proxies) || proxies.length === 0) {
      return fetch(url, options);
    }
    const target = proxies[index] + encodeURIComponent(url);
    return fetch(target, this._cloneRequestInit(options))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response;
      })
      .catch((error) => {
        if (index >= proxies.length - 1) {
          throw error;
        }
        return this._fetchThroughProxy(url, options, index + 1);
      });
  }

  _cloneRequestInit(options) {
    if (!options) {
      return undefined;
    }
    const init = { ...options };
    if (options.body instanceof FormData) {
      const cloned = new FormData();
      options.body.forEach((value, key) => {
        cloned.append(key, value);
      });
      init.body = cloned;
    }
    return init;
  }
}

customElements.define('x-frame-bypass', XFrameBypassElement, { extends: 'iframe' });
