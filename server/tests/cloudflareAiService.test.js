const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVaultSources,
  generateVaultAnswer,
  isPrivateVaultItem,
  isSensitiveQuery,
  redactSensitiveText
} = require('../services/cloudflareAiService');

test('AI sources omit private items and items in private folders', () => {
  const sources = buildVaultSources([
    {
      _id: 'public-1',
      title: 'Travel plan',
      type: 'note',
      content: 'Flight leaves at 8:30.',
      folderId: { name: 'Travel', isPrivate: false }
    },
    {
      _id: 'private-folder',
      title: 'Wi-Fi password',
      type: 'note',
      content: 'Password: secret-value',
      folderId: { name: 'Private & Important', isPrivate: true }
    },
    {
      _id: 'private-item',
      title: 'Personal note',
      type: 'note',
      content: 'Only local',
      isPrivate: true
    }
  ]);

  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 'public-1');
  assert.match(sources[0].excerpt, /Flight leaves at 8:30/);
  assert.equal(isPrivateVaultItem({ folderId: { isPrivate: true } }), true);
});

test('credential-like text is redacted before reaching the model', () => {
  const input = [
    'Password: not-for-cloudflare',
    'Bearer abc.def.ghi',
    'https://example.test/?access_token=private-value',
    'sk-123456789012345678901234'
  ].join('\n');
  const redacted = redactSensitiveText(input);

  assert.doesNotMatch(redacted, /not-for-cloudflare|abc\.def\.ghi|private-value|sk-123456789012345678901234/);
  assert.match(redacted, /\[REDACTED/);
});

test('password and credential lookups are classified as local-only', () => {
  assert.equal(isSensitiveQuery('What is my Wi-Fi password?'), true);
  assert.equal(isSensitiveQuery('Find my API key'), true);
  assert.equal(isSensitiveQuery('Summarize my design notes'), false);
});

test('Workers AI request uses the configured account and model without exposing sources in errors', async () => {
  let sentUrl;
  let sentOptions;
  const result = await generateVaultAnswer({
    query: 'Summarize this note',
    items: [{
      _id: 'source-1',
      title: 'Project note',
      type: 'note',
      content: 'A grounded fact.',
      folderId: { name: 'Work' }
    }],
    env: {
      CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct'
    },
    fetchImpl: async (url, options) => {
      sentUrl = url;
      sentOptions = options;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'The note records a grounded fact [1].' } }]
        })
      };
    }
  });

  assert.match(sentUrl, /\/accounts\/0123456789abcdef0123456789abcdef\/ai\/v1\/chat\/completions$/);
  assert.equal(sentOptions.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(sentOptions.body).model, '@cf/meta/llama-3.1-8b-instruct');
  assert.equal(result.answer, 'The note records a grounded fact [1].');
  assert.equal(result.sources[0].id, 'source-1');
});
