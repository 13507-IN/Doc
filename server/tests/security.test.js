const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const {
  assertPublicHttpUrl,
  isPrivateAddress
} = require('../controllers/metadataController');
const {
  ACCESS_TOKEN_LIFETIME,
  JWT_AUDIENCE,
  JWT_ISSUER,
  createAccessToken,
  getJwtSecret
} = require('../config/security');
const { serializeItem } = require('../services/itemSerializer');

test('blocks private, reserved, and non-global IP address ranges', () => {
  const blocked = [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:8.8.8.8'
  ];
  for (const address of blocked) {
    assert.equal(isPrivateAddress(address), true, `${address} must be blocked`);
  }
});

test('allows globally routable IP addresses', () => {
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('URL validator rejects non-HTTP, credentialed, and private destinations', async () => {
  await assert.rejects(
    assertPublicHttpUrl(new URL('file:///etc/passwd')),
    /Only public HTTP\(S\) URLs are supported/
  );
  await assert.rejects(
    assertPublicHttpUrl(new URL('https://user:pass@example.com/')),
    /Only public HTTP\(S\) URLs are supported/
  );
  await assert.rejects(
    assertPublicHttpUrl(new URL('http://127.0.0.1/')),
    /Local network URLs are not supported/
  );
  await assert.rejects(
    assertPublicHttpUrl(new URL('http://[::1]/')),
    /Local network URLs are not supported/
  );
});

test('serialized uploaded media uses the authenticated proxy without exposing storage IDs', () => {
  const itemId = '64b000000000000000000001';
  const item = serializeItem({
    _id: itemId,
    type: 'image',
    url: 'https://example.com/source',
    previewUrl: 'https://res.cloudinary.com/demo/image/upload/legacy.jpg',
    metadata: {
      cloudinaryPublicId: 'holder/user/image',
      cloudinaryType: 'authenticated',
      cloudinaryResourceType: 'image',
      mediaMimeType: 'image/jpeg',
      authorName: 'Example'
    }
  });

  assert.equal(item.mediaUrl, `/api/items/${itemId}/media`);
  assert.equal(item.url, 'https://example.com/source');
  assert.equal(item.previewUrl, '');
  assert.deepEqual(item.metadata, { authorName: 'Example' });
});

test('migration groups records by Cloudinary resource type and public ID', () => {
  const { groupLegacyItems } = require('../scripts/migrate-cloudinary-private');
  const groups = groupLegacyItems([
    { _id: 'one', type: 'image', metadata: { cloudinaryPublicId: 'holder/a' } },
    { _id: 'two', type: 'image', metadata: { cloudinaryPublicId: 'holder/a' } },
    { _id: 'three', type: 'pdf', metadata: { cloudinaryPublicId: 'holder/a' } }
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map(({ resourceType, items }) => [resourceType, items.length]).sort(),
    [['image', 2], ['raw', 1]]
  );
});

test('access tokens require a strong secret and contain no profile data', () => {
  const originalSecret = process.env.JWT_SECRET;
  const secret = crypto.randomBytes(48).toString('base64url');

  try {
    process.env.JWT_SECRET = 'too-short';
    assert.throws(getJwtSecret, /at least 32 bytes/);

    process.env.JWT_SECRET = secret;
    const token = createAccessToken({ _id: '64b000000000000000000001', email: 'person@example.com' });
    const claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    assert.equal(claims.sub, '64b000000000000000000001');
    assert.equal(claims.iss, JWT_ISSUER);
    assert.equal(claims.aud, JWT_AUDIENCE);
    assert.equal(claims.email, undefined);
    assert.equal(claims.name, undefined);
    assert.equal(ACCESS_TOKEN_LIFETIME, '12h');
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
