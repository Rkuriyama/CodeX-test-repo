(() => {
  const IGNORED_COMMANDS = new Set([
    'text', 'frac', 'sqrt', 'left', 'right', 'begin', 'end', 'label', 'mathrm',
    'operatorname', 'mathbf', 'boldsymbol', 'cdot', 'times', 'sin', 'cos', 'tan',
    'log', 'exp', 'sum', 'int', 'prod', 'lim', 'min', 'max', 'det', 'dim',
    'displaystyle', 'qquad', 'quad', 'smallskip', 'bigskip'
  ]);

  const state = {
    lastConflictCount: 0,
    initialized: false,
    popup: null,
    tableBody: null,
    cautionArea: null,
    statusArea: null,
    resolutionMessage: ''
  };

  function createInterface() {
    if (state.initialized) {
      return;
    }

    const toggleButton = document.createElement('button');
    toggleButton.className = 'cx-toggle-button';
    toggleButton.type = 'button';
    toggleButton.textContent = 'Variables';

    const popup = document.createElement('section');
    popup.className = 'cx-popup cx-popup-hidden';

    const header = document.createElement('header');
    header.className = 'cx-popup__header';

    const title = document.createElement('h1');
    title.textContent = 'LaTeX Variables';
    title.className = 'cx-popup__title';

    const refreshButton = document.createElement('button');
    refreshButton.className = 'cx-refresh-button';
    refreshButton.type = 'button';
    refreshButton.textContent = '更新';

    header.append(title, refreshButton);

    const cautionArea = document.createElement('div');
    cautionArea.className = 'cx-caution-area';

    const statusArea = document.createElement('div');
    statusArea.className = 'cx-status-area';

    const table = document.createElement('table');
    table.className = 'cx-variable-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['変数', '物理量', '抜粋'];
    headers.forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');

    table.append(thead, tbody);

    popup.append(header, cautionArea, statusArea, table);

    toggleButton.addEventListener('click', () => {
      popup.classList.toggle('cx-popup-hidden');
    });

    refreshButton.addEventListener('click', () => {
      refreshButton.disabled = true;
      refreshButton.textContent = '更新中…';

      const finish = () => {
        refreshButton.disabled = false;
        refreshButton.textContent = '更新';
      };

      const runUpdate = () => {
        try {
          updateAnalysis();
        } finally {
          finish();
        }
      };

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runUpdate);
      } else {
        window.setTimeout(runUpdate, 0);
      }
    });

    document.body.append(toggleButton, popup);

    state.popup = popup;
    state.tableBody = tbody;
    state.cautionArea = cautionArea;
    state.statusArea = statusArea;
    state.initialized = true;

    updateAnalysis();
  }

  function extractLatexExpressions() {
    const expressions = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    const inlineRegex = /\$([\s\S]+?)\$/g;
    const displayRegex = /\$\$([\s\S]+?)\$\$/g;
    const bracketRegex = /\\\[([\s\S]+?)\\\]/g;
    const parenRegex = /\\\(([\s\S]+?)\\\)/g;

    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) {
        continue;
      }
      const text = node.nodeValue;
      if (!/[\\$]/.test(text)) {
        continue;
      }
      collectFromText(node, text, inlineRegex, expressions);
      collectFromText(node, text, displayRegex, expressions);
      collectFromText(node, text, bracketRegex, expressions);
      collectFromText(node, text, parenRegex, expressions);
    }

    const scriptNodes = document.querySelectorAll('script[type^="math/tex"], script[type^="math/LaTeX"]');
    scriptNodes.forEach((script) => {
      const latex = script.textContent || '';
      if (!latex.trim()) {
        return;
      }
      expressions.push({
        latex: latex.trim(),
        contextBefore: '',
        contextAfter: '',
        snippet: buildSnippet('', latex.trim(), ''),
        element: script
      });
    });

    return expressions;
  }

  function collectFromText(node, text, regex, target) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      const latex = match[1];
      if (!latex) {
        continue;
      }
      if (/^\$/.test(match[0]) && /\$\$/.test(match[0])) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      const contextBefore = text.slice(Math.max(0, start - 80), start);
      const contextAfter = text.slice(end, Math.min(text.length, end + 120));
      target.push({
        latex,
        contextBefore,
        contextAfter,
        snippet: buildSnippet(contextBefore, latex, contextAfter),
        element: node.parentElement || document.body
      });
    }
  }

  function buildSnippet(before, latex, after) {
    const raw = `${before || ''}$${latex}$${after || ''}`
      .replace(/\s+/g, ' ')
      .trim();
    return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
  }

  function analyzeExpressions(expressions) {
    const variableMap = new Map();
    const quantityMap = new Map();

    expressions.forEach((expression) => {
      const definitions = extractDefinitions(expression);
      if (definitions.length > 0) {
        definitions.forEach((def) => {
          registerOccurrence(def.variable, def.quantity, expression.snippet, variableMap, quantityMap);
        });
      } else {
        const variables = extractVariablesFromLatex(expression.latex);
        variables.forEach((variable) => {
          const inferredQuantity = inferQuantityFromContext(variable, expression.contextBefore, expression.contextAfter);
          registerOccurrence(variable, inferredQuantity, expression.snippet, variableMap, quantityMap);
        });
      }
    });

    const rows = [];
    const conflictRowKeys = new Set();
    const conflictMessages = [];

    variableMap.forEach((info, variable) => {
      const distinctKnownQuantities = Array.from(info.quantities.keys()).filter((key) => key !== '');
      if (distinctKnownQuantities.length > 1) {
        conflictMessages.push(`変数 ${variable} に複数の物理量が割り当てられています。`);
        distinctKnownQuantities.forEach((key) => {
          conflictRowKeys.add(`${variable}|||${key}`);
        });
      }
      info.quantities.forEach((detail, key) => {
        const displayQuantity = detail.quantity || '不明';
        rows.push({
          variable,
          quantity: displayQuantity,
          quantityKey: key,
          snippet: detail.snippets[0] || ''
        });
      });
    });

    quantityMap.forEach((record, key) => {
      if (record.variables.size > 1) {
        const label = record.label;
        conflictMessages.push(`物理量「${label}」に複数の変数が割り当てられています。`);
        record.variables.forEach((variable) => {
          conflictRowKeys.add(`${variable}|||${key}`);
        });
      }
    });

    rows.sort((a, b) => a.variable.localeCompare(b.variable));

    return {
      rows,
      conflictRowKeys,
      conflictMessages
    };
  }

  function registerOccurrence(variable, quantity, snippet, variableMap, quantityMap) {
    const normalizedVariable = variable.trim();
    if (!normalizedVariable) {
      return;
    }
    const normalizedQuantity = (quantity || '').trim();

    if (!variableMap.has(normalizedVariable)) {
      variableMap.set(normalizedVariable, {
        quantities: new Map()
      });
    }
    const variableInfo = variableMap.get(normalizedVariable);
    const quantityKey = normalizedQuantity.toLowerCase();
    if (!variableInfo.quantities.has(quantityKey)) {
      variableInfo.quantities.set(quantityKey, {
        quantity: normalizedQuantity,
        snippets: []
      });
    }
    const detail = variableInfo.quantities.get(quantityKey);
    if (snippet && !detail.snippets.includes(snippet)) {
      detail.snippets.push(snippet);
    }

    if (normalizedQuantity) {
      if (!quantityMap.has(quantityKey)) {
        quantityMap.set(quantityKey, {
          label: normalizedQuantity,
          variables: new Set()
        });
      }
      quantityMap.get(quantityKey).variables.add(normalizedVariable);
    }
  }

  function extractDefinitions(expression) {
    const { latex, contextBefore, contextAfter } = expression;
    const definitions = [];

    const equationPatterns = [
      {
        pattern: /((?:\\[a-zA-Z]+|[a-zA-Z])[a-zA-Z0-9]*?(?:_{[^}]+}|_[a-zA-Z0-9])?)\s*(?:=|:=|\\equiv)\s*\\text\{([^}]+)\}/g,
        variableIndex: 1,
        quantityIndex: 2
      },
      {
        pattern: /\\text\{([^}]+)\}\s*(?:=|:=|\\equiv)\s*((?:\\[a-zA-Z]+|[a-zA-Z])[a-zA-Z0-9]*?(?:_{[^}]+}|_[a-zA-Z0-9])?)/g,
        variableIndex: 2,
        quantityIndex: 1
      }
    ];

    equationPatterns.forEach(({ pattern, variableIndex, quantityIndex }) => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(latex))) {
        const variable = normalizeVariable(match[variableIndex]);
        if (!variable) {
          continue;
        }
        if (variable.startsWith('\\')) {
          const commandMatch = variable.slice(1).match(/^[a-zA-Z]+/);
          if (commandMatch && IGNORED_COMMANDS.has(commandMatch[0].toLowerCase())) {
            continue;
          }
        }
        const quantity = cleanQuantity(match[quantityIndex]);
        if (variable && quantity) {
          definitions.push({
            variable,
            quantity
          });
        }
      }
    });

    if (definitions.length > 0) {
      return definitions;
    }

    const variables = extractVariablesFromLatex(latex);
    const uniqueVariables = Array.from(new Set(variables));
    const contextualDefinitions = [];
    uniqueVariables.forEach((variable) => {
      const inferred = inferQuantityFromContext(variable, contextBefore, contextAfter);
      if (inferred) {
        contextualDefinitions.push({
          variable,
          quantity: inferred
        });
      }
    });

    return contextualDefinitions;
  }

  function extractVariablesFromLatex(latex) {
    const variables = new Set();

    const greekMatches = latex.match(/\\[a-zA-Z]+/g) || [];
    greekMatches.forEach((match) => {
      const command = match.slice(1).toLowerCase();
      if (!IGNORED_COMMANDS.has(command)) {
        variables.add(`\\${command}`);
      }
    });

    const varRegex = /[a-zA-Z](?:_{[^}]+}|_[a-zA-Z0-9])?/g;
    let match;
    while ((match = varRegex.exec(latex))) {
      const token = match[0];
      const index = match.index || 0;
      if (index > 0 && latex[index - 1] === '\\') {
        continue;
      }
      const normalized = normalizeVariable(token);
      if (normalized && !IGNORED_COMMANDS.has(normalized.toLowerCase())) {
        variables.add(normalized);
      }
    }

    return Array.from(variables);
  }

  function normalizeVariable(token) {
    return token ? token.trim() : '';
  }

  function cleanQuantity(raw) {
    if (!raw) {
      return '';
    }
    return raw
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/\\operatorname\{([^}]*)\}/g, '$1')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}_^]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inferQuantityFromContext(variable, contextBefore, contextAfter) {
    const cleanedBefore = (contextBefore || '').replace(/\s+/g, ' ').trim();
    const cleanedAfter = (contextAfter || '').replace(/\s+/g, ' ').trim();

    const afterMatch = cleanedAfter.match(/^(?:denotes|represents|is|are|stands for|describes)\s+([^.;:,]+)/i)
      || cleanedAfter.match(/(?:denotes|represents|is|are|stands for|describes)\s+([^.;:,]+)/i);
    if (afterMatch && afterMatch[1]) {
      return normalizeQuantityPhrase(afterMatch[1]);
    }

    const beforeMatch = cleanedBefore.match(/([^.;:,]+)\s+(?:denotes|represents|is|are|stands for|describes)$/i);
    if (beforeMatch && beforeMatch[1]) {
      return normalizeQuantityPhrase(beforeMatch[1]);
    }

    const nounPhraseMatch = cleanedBefore.match(/([A-Za-z][A-Za-z0-9\s\-]{2,})$/);
    if (nounPhraseMatch && nounPhraseMatch[1]) {
      return normalizeQuantityPhrase(nounPhraseMatch[1]);
    }

    return '';
  }

  function normalizeQuantityPhrase(phrase) {
    return phrase
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function updateAnalysis() {
    const expressions = extractLatexExpressions();
    const analysis = analyzeExpressions(expressions);
    renderTable(analysis);
    renderCaution(analysis);
    renderStatus(expressions.length);
  }

  function renderTable(analysis) {
    if (!state.tableBody) {
      return;
    }
    state.tableBody.textContent = '';

    if (analysis.rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 3;
      emptyCell.textContent = 'LaTeXの変数が検出されませんでした。';
      emptyRow.appendChild(emptyCell);
      state.tableBody.appendChild(emptyRow);
      return;
    }

    analysis.rows.forEach((row) => {
      const tr = document.createElement('tr');
      const variableCell = document.createElement('td');
      variableCell.textContent = row.variable;

      const quantityCell = document.createElement('td');
      quantityCell.textContent = row.quantity;

      const snippetCell = document.createElement('td');
      snippetCell.textContent = row.snippet;

      const key = `${row.variable}|||${row.quantityKey}`;
      if (analysis.conflictRowKeys.has(key)) {
        variableCell.classList.add('cx-conflict-cell');
        quantityCell.classList.add('cx-conflict-cell');
      }

      tr.append(variableCell, quantityCell, snippetCell);
      state.tableBody.appendChild(tr);
    });
  }

  function renderCaution(analysis) {
    if (!state.cautionArea) {
      return;
    }
    state.cautionArea.textContent = '';

    if (analysis.conflictMessages.length > 0) {
      const list = document.createElement('ul');
      list.className = 'cx-caution-list';
      analysis.conflictMessages.forEach((message) => {
        const item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      });
      state.cautionArea.appendChild(list);
      state.lastConflictCount = analysis.conflictMessages.length;
      state.resolutionMessage = '';
      return;
    }

    if (state.lastConflictCount > 0) {
      const resolved = document.createElement('p');
      resolved.className = 'cx-resolved-message';
      const timestamp = new Date().toLocaleString();
      resolved.textContent = `以前の警告は解消されました (${timestamp})。`;
      state.cautionArea.appendChild(resolved);
      state.lastConflictCount = 0;
      state.resolutionMessage = resolved.textContent;
      return;
    }

    if (state.resolutionMessage) {
      const resolved = document.createElement('p');
      resolved.className = 'cx-resolved-message';
      resolved.textContent = state.resolutionMessage;
      state.cautionArea.appendChild(resolved);
    }
  }

  function renderStatus(expressionCount) {
    if (!state.statusArea) {
      return;
    }
    state.statusArea.textContent = `検出されたLaTeX表現: ${expressionCount}`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInterface, { once: true });
  } else {
    createInterface();
  }
})();
