const assert = require('node:assert/strict');
const test = require('node:test');

const { saveData } = require('../api/save');

test('saveData updates data.json through GitHub Contents API', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });

    if (!options.method) {
      return jsonResponse(200, { sha: 'current-sha' });
    }

    assert.equal(options.method, 'PUT');
    const body = JSON.parse(options.body);
    assert.equal(body.sha, 'current-sha');
    assert.equal(body.message, 'sync calendar data');
    assert.deepEqual(
      JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')),
      { tasks: [{ id: '1', title: 'Nueva tarea' }], nodes: [], ideas: [] }
    );

    return jsonResponse(200, { content: { sha: 'next-sha' } });
  };

  const result = await saveData({
    state: { tasks: [{ id: '1', title: 'Nueva tarea' }], nodes: [], ideas: [] },
    env: {
      GITHUB_TOKEN: 'secret-token',
      GITHUB_REPO: 'owner/repo',
      GITHUB_BRANCH: 'main'
    },
    fetchImpl
  });

  assert.deepEqual(result, { ok: true, sha: 'next-sha' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.github.com/repos/owner/repo/contents/data.json?ref=main');
  assert.equal(calls[1].url, 'https://api.github.com/repos/owner/repo/contents/data.json');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer secret-token');
});

test('saveData requires a GitHub token', async () => {
  await assert.rejects(
    () => saveData({ state: { tasks: [], nodes: [], ideas: [] }, env: {}, fetchImpl: async () => {} }),
    /Missing GITHUB_TOKEN/
  );
});

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return value;
    }
  };
}
