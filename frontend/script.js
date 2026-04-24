const BASE_URL = 'http://localhost:3003'; // change after deploy

const inputEl = document.getElementById('input');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const exampleBtn = document.getElementById('exampleBtn');
const resultsEl = document.getElementById('results');
const errorBannerEl = document.getElementById('errorBanner');

const userIdEl = document.getElementById('userId');
const emailIdEl = document.getElementById('emailId');
const rollNumberEl = document.getElementById('rollNumber');

const treeViewEl = document.getElementById('treeView');
const invalidTagsEl = document.getElementById('invalidTags');
const duplicateTagsEl = document.getElementById('duplicateTags');

const totalTreesEl = document.getElementById('totalTrees');
const totalCyclesEl = document.getElementById('totalCycles');
const largestRootEl = document.getElementById('largestRoot');

const EXAMPLE_INPUT = 'A->B, B->C, A->B, X->X, bad, D->E, E->F, A->D';

function setLoading(isLoading) {
  submitBtn.classList.toggle('loading', isLoading);
  submitBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;
  exampleBtn.disabled = isLoading;
}

function showError(message) {
  errorBannerEl.textContent = message;
  errorBannerEl.classList.remove('hidden');
}

function clearError() {
  errorBannerEl.textContent = '';
  errorBannerEl.classList.add('hidden');
}

function renderTags(container, items, className) {
  container.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'tag';
    empty.textContent = 'None';
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    const tag = document.createElement('span');
    tag.className = `tag ${className}`;
    tag.textContent = String(item);
    container.appendChild(tag);
  }
}

function renderTree(node, prefix = '', isLast = true) {
  const keys = Object.keys(node || {});
  let output = '';

  keys.forEach((child, index) => {
    const last = index === keys.length - 1;
    output += `${prefix}${last ? '└── ' : '├── '}${child}\n`;
    const childPrefix = `${prefix}${last ? '    ' : '│   '}`;
    output += renderTree(node[child], childPrefix, last);
  });

  return output;
}

function renderTreeView(response) {
  const hierarchies = Array.isArray(response.hierarchies)
    ? response.hierarchies
    : (Array.isArray(response.components) ? response.components : []);

  if (hierarchies.length === 0) {
    treeViewEl.textContent = 'No trees found.';
    return;
  }

  const chunks = [];

  hierarchies.forEach((component, index) => {
    const root = component.root || 'Unknown';
    const rootLine = `${root}`;

    const treeObj = component.tree || {};
    const branchSource = treeObj[root] || treeObj;
    const branchLines = component.has_cycle ? '' : renderTree(branchSource);

    const cycleNote = component.has_cycle ? ' [cycle detected]' : '';
    chunks.push(`${rootLine}${cycleNote}\n${branchLines || ''}`.trimEnd());

    if (index < hierarchies.length - 1) {
      chunks.push('');
    }
  });

  treeViewEl.textContent = chunks.join('\n');
}

function renderResults(response) {
  userIdEl.textContent = response.user_id || '-';
  emailIdEl.textContent = response.email_id || '-';
  rollNumberEl.textContent = response.college_roll_number || '-';

  renderTreeView(response);
  renderTags(invalidTagsEl, response.invalid_entries, 'tag-invalid');
  renderTags(duplicateTagsEl, response.duplicate_edges, 'tag-duplicate');

  totalTreesEl.textContent = String(response.summary?.total_trees ?? 0);
  totalCyclesEl.textContent = String(response.summary?.total_cycles ?? 0);
  largestRootEl.textContent = response.summary?.largest_tree_root ?? '-';

  resultsEl.classList.remove('hidden');
}

async function callAPI() {
  clearError();
  setLoading(true);

  try {
    const raw = inputEl.value;
    const data = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const res = await fetch(`${BASE_URL}/bfhl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });

    let json;
    try {
      json = await res.json();
    } catch (error) {
      throw new Error('Server returned non-JSON response.');
    }

    if (!res.ok) {
      throw new Error(json.error || 'Request failed');
    }

    renderResults(json);
  } catch (error) {
    resultsEl.classList.add('hidden');
    showError(`API request failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

submitBtn.addEventListener('click', callAPI);

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  clearError();
  resultsEl.classList.add('hidden');
});

exampleBtn.addEventListener('click', () => {
  inputEl.value = EXAMPLE_INPUT;
  clearError();
});

inputEl.value = EXAMPLE_INPUT;
