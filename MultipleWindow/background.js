const dashboardTabs = new Set();

const registerTab = (tabId) => {
  if (typeof tabId === 'number') {
    dashboardTabs.add(tabId);
  }
};

const unregisterTab = (tabId) => {
  if (typeof tabId === 'number') {
    dashboardTabs.delete(tabId);
  }
};

chrome.action.onClicked.addListener(async () => {
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html')
  });
  if (tab?.id !== undefined) {
    registerTab(tab.id);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  unregisterTab(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type === 'registerDashboard') {
    const tabId =
      typeof message.tabId === 'number'
        ? message.tabId
        : sender?.tab?.id ?? undefined;
    if (tabId !== undefined) {
      registerTab(tabId);
    }
    if (typeof sendResponse === 'function') {
      sendResponse({ tabId });
    }
    return false;
  }

  if (message.type === 'unregisterDashboard') {
    const tabId =
      typeof message.tabId === 'number'
        ? message.tabId
        : sender?.tab?.id ?? undefined;
    if (tabId !== undefined) {
      unregisterTab(tabId);
    }
  }
});

const extractFrameBlockingReason = (responseHeaders = []) => {
  const reasons = [];
  let frameAncestors = null;

  responseHeaders.forEach((header) => {
    if (!header || !header.name) {
      return;
    }
    const name = header.name.toLowerCase();
    if (name === 'x-frame-options') {
      const value = header.value ?? '';
      reasons.push(`X-Frame-Options: ${value}`);
      return;
    }
    if (name === 'content-security-policy') {
      const value = header.value ?? '';
      const directive = value
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.toLowerCase().startsWith('frame-ancestors'));
      if (directive) {
        frameAncestors = directive.split(/\s+/).slice(1);
      }
    }
  });

  if (Array.isArray(frameAncestors) && frameAncestors.length > 0) {
    const normalized = frameAncestors.map((token) => token.toLowerCase());
    const allowsAny = normalized.includes('*') || normalized.some((token) => token.startsWith('chrome-extension://'));
    if (!allowsAny) {
      reasons.push(`Content-Security-Policy: frame-ancestors ${frameAncestors.join(' ')}`);
    }
  }

  if (reasons.length === 0) {
    return null;
  }

  return reasons.join(' / ');
};

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!dashboardTabs.has(details.tabId)) {
      return;
    }

    const reason = extractFrameBlockingReason(details.responseHeaders);
    if (!reason) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'frameBlocked',
      tabId: details.tabId,
      url: details.url,
      reason
    });
  },
  { urls: ['<all_urls>'], types: ['sub_frame'] },
  ['extraHeaders']
);
