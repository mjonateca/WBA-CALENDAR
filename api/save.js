const DATA_FILE = 'data.json';
const DEFAULT_REPO = 'mjonateca/WBA-CALENDAR';
const DEFAULT_BRANCH = 'main';

async function saveData({ state, env = process.env, fetchImpl = fetch }) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;

  if (!token) throw new Error('Missing GITHUB_TOKEN');
  validateState(state);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const current = await githubJson(
    fetchImpl,
    `https://api.github.com/repos/${repo}/contents/${DATA_FILE}?ref=${encodeURIComponent(branch)}`,
    { headers }
  );

  const content = Buffer.from(JSON.stringify(normalizeState(state), null, 2), 'utf8').toString('base64');
  const result = await githubJson(
    fetchImpl,
    `https://api.github.com/repos/${repo}/contents/${DATA_FILE}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'sync calendar data',
        content,
        sha: current.sha,
        branch
      })
    }
  );

  return { ok: true, sha: result.content && result.content.sha };
}

async function githubJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `GitHub API error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function validateState(state) {
  if (!state || typeof state !== 'object') throw new Error('Invalid state');
  for (const key of ['tasks', 'nodes', 'ideas']) {
    if (!Array.isArray(state[key])) throw new Error(`Invalid state.${key}`);
  }
}

function normalizeState(state) {
  return {
    tasks: state.tasks,
    nodes: state.nodes,
    ideas: state.ideas
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const result = await saveData({ state: req.body });
    return res.status(200).json(result);
  } catch (error) {
    const status = error.message === 'Missing GITHUB_TOKEN' ? 500 : error.status || 400;
    return res.status(status).json({ ok: false, error: error.message });
  }
}

module.exports = handler;
module.exports.saveData = saveData;
