const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const USER_ID = 'lakshyajain_08082004';
const EMAIL_ID = 'lj0928@srmist.edu.in';
const COLLEGE_ROLL_NUMBER = 'RA2311005010099';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.options('/bfhl', cors());

const EDGE_REGEX = /^[A-Z]->[A-Z]$/;

function buildGraph(entries) {
  const invalid_entries = [];
  const duplicate_edges = [];

  const seen = new Set();
  const duplicateSeen = new Set();

  const adjacency = new Map();
  const inDegree = new Map();
  const allNodes = new Set();
  const firstParent = new Map();
  const nodeOrder = new Map();
  let orderCounter = 0;

  for (const rawEntry of entries) {
    const entry = typeof rawEntry === 'string' ? rawEntry.trim() : '';

    if (!EDGE_REGEX.test(entry)) {
      invalid_entries.push(entry);
      continue;
    }

    const parent = entry[0];
    const child = entry[3];

    if (parent === child) {
      invalid_entries.push(entry);
      continue;
    }

    if (seen.has(entry)) {
      if (!duplicateSeen.has(entry)) {
        duplicate_edges.push(entry);
        duplicateSeen.add(entry);
      }
      continue;
    }

    seen.add(entry);

    if (!nodeOrder.has(parent)) nodeOrder.set(parent, orderCounter++);
    if (!nodeOrder.has(child)) nodeOrder.set(child, orderCounter++);

    if (!adjacency.has(parent)) adjacency.set(parent, []);
    adjacency.get(parent).push(child);

    if (!firstParent.has(child)) {
      firstParent.set(child, parent);
    }

    if (!inDegree.has(parent)) inDegree.set(parent, 0);
    inDegree.set(child, (inDegree.get(child) || 0) + 1);

    allNodes.add(parent);
    allNodes.add(child);
  }

  for (const node of allNodes) {
    if (!adjacency.has(node)) adjacency.set(node, []);
    if (!inDegree.has(node)) inDegree.set(node, 0);
  }

  return {
    invalid_entries,
    duplicate_edges,
    adjacency,
    inDegree,
    allNodes,
    firstParent,
    nodeOrder,
  };
}

function buildWeakComponents(adjacency, allNodes) {
  const undirected = new Map();

  for (const node of allNodes) {
    undirected.set(node, new Set());
  }

  for (const [parent, children] of adjacency.entries()) {
    for (const child of children) {
      undirected.get(parent).add(child);
      undirected.get(child).add(parent);
    }
  }

  const visited = new Set();
  const components = [];

  for (const node of allNodes) {
    if (visited.has(node)) continue;

    const stack = [node];
    const nodes = [];
    visited.add(node);

    while (stack.length > 0) {
      const current = stack.pop();
      nodes.push(current);

      for (const next of undirected.get(current) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    components.push(nodes);
  }

  return components;
}

function componentHasCycle(componentNodes, adjacency) {
  const inComponent = new Set(componentNodes);
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    visited.add(node);
    stack.add(node);

    for (const next of adjacency.get(node) || []) {
      if (!inComponent.has(next)) continue;

      if (!visited.has(next)) {
        if (dfs(next)) return true;
      } else if (stack.has(next)) {
        return true;
      }
    }

    stack.delete(node);
    return false;
  }

  for (const node of componentNodes) {
    if (!visited.has(node) && dfs(node)) {
      return true;
    }
  }

  return false;
}

function detectCycleAndDepthFrom(root, adjacency) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) {
      return { hasCycle: true, depth: 0 };
    }

    if (visited.has(node)) {
      return { hasCycle: false, depth: 1 };
    }

    visited.add(node);
    stack.add(node);

    let maxChildDepth = 0;

    for (const next of adjacency.get(node) || []) {
      const result = dfs(next);
      if (result.hasCycle) {
        return { hasCycle: true, depth: 0 };
      }
      maxChildDepth = Math.max(maxChildDepth, result.depth);
    }

    stack.delete(node);

    return { hasCycle: false, depth: maxChildDepth + 1 };
  }

  return dfs(root);
}

function buildTreeFromRoot(root, adjacency, firstParent) {
  const tree = {};
  const treeVisited = new Set([root]);

  function attach(node, target) {
    const children = adjacency.get(node) || [];

    for (const child of children) {
      if (firstParent.get(child) !== node) {
        continue;
      }

      if (treeVisited.has(child)) {
        continue;
      }

      treeVisited.add(child);
      target[child] = {};
      attach(child, target[child]);
    }
  }

  attach(root, tree);
  return tree;
}

function computeDepthFromTree(treeNode) {
  const children = Object.values(treeNode);
  if (children.length === 0) return 1;

  let maxChildDepth = 0;
  for (const child of children) {
    maxChildDepth = Math.max(maxChildDepth, computeDepthFromTree(child));
  }

  return maxChildDepth + 1;
}

function analyzeForest(data) {
  const {
    invalid_entries,
    duplicate_edges,
    adjacency,
    inDegree,
    allNodes,
    firstParent,
    nodeOrder,
  } = buildGraph(data);

  const weakComponents = buildWeakComponents(adjacency, allNodes);
  const hierarchies = [];
  let totalCycles = 0;

  for (const componentNodes of weakComponents) {
    const componentRoots = componentNodes
      .filter((node) => (inDegree.get(node) || 0) === 0)
      .sort((a, b) => (nodeOrder.get(a) || 0) - (nodeOrder.get(b) || 0));

    const hasCycle = componentHasCycle(componentNodes, adjacency);
    if (hasCycle) totalCycles += 1;

    if (componentRoots.length === 0) {
      // Rootless components are cycle-only groups.
      const cycleRoot = [...componentNodes].sort()[0];
      hierarchies.push({
        root: cycleRoot,
        tree: {},
        has_cycle: true,
      });
      continue;
    }

    for (const root of componentRoots) {
      const cycleCheck = detectCycleAndDepthFrom(root, adjacency);

      if (cycleCheck.hasCycle) {
        hierarchies.push({
          root,
          tree: {},
          has_cycle: true,
        });
      } else {
        const tree = buildTreeFromRoot(root, adjacency, firstParent);
        hierarchies.push({
          root,
          tree: {
            [root]: tree,
          },
          depth: computeDepthFromTree(tree),
        });
      }
    }
  }

  const acyclicTrees = hierarchies.filter((item) => item.has_cycle !== true);

  let largest_tree_root = null;
  let largestDepth = -1;

  for (const treeInfo of acyclicTrees) {
    if (
      treeInfo.depth > largestDepth ||
      (treeInfo.depth === largestDepth && (largest_tree_root === null || treeInfo.root < largest_tree_root))
    ) {
      largestDepth = treeInfo.depth;
      largest_tree_root = treeInfo.root;
    }
  }

  return {
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees: acyclicTrees.length,
      total_cycles: totalCycles,
      largest_tree_root,
    },
  };
}

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'BFHL API is running',
    endpoint: '/bfhl',
    method: 'POST',
  });
});

app.get('/bfhl', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Use POST /bfhl with JSON body: { "data": ["A->B", "B->C"] }',
  });
});

app.post('/bfhl', (req, res) => {
  try {
    const { data } = req.body || {};

    if (!Array.isArray(data)) {
      return res.status(400).json({
        is_success: false,
        error: 'Request body must include data as an array of strings.',
      });
    }

    const result = analyzeForest(data);

    return res.status(200).json({
      user_id: USER_ID,
      email_id: EMAIL_ID,
      college_roll_number: COLLEGE_ROLL_NUMBER,
      hierarchies: result.hierarchies,
      invalid_entries: result.invalid_entries,
      duplicate_edges: result.duplicate_edges,
      summary: result.summary,
    });
  } catch (error) {
    return res.status(500).json({
      is_success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
