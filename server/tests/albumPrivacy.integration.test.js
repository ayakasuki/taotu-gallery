import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const enabled = process.env.TAOTU_RUN_DB_TESTS === '1' && /^taotu_policy_test_\d+$/.test(process.env.DB_NAME || '');

test('album privacy and random media HTTP integration on an isolated database', { skip: !enabled, timeout: 120000 }, async suite => {
  const { default: db } = await import('../db/index.js');
  const { default: jwt } = await import('jsonwebtoken');
  const { default: sharp } = await import('sharp');
  const { default: configService } = await import('../services/configService.js');
  const { up, down } = await import('../db/migrations/20241101000001_add_album_privacy.js');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taotu-policy-images-'));
  let server;
  try {
    await db.migrate.latest();
    assert.equal(await db.schema.hasColumn('albums', 'is_private'), true);
    await down(db);
    await db('albums').insert({ id: 90, name: 'upgrade-probe', user_id: 2, cover_image_id: 900 });
    await db('images').insert({ id: 900, filename: 'probe.jpg', path: 'probe.jpg', album_id: 90, nsfw_status: true });
    await up(db);
    await up(db);
    const migrated = await db('albums').where({ id: 90 }).first();
    assert.equal(migrated.is_private, 0);
    assert.equal(migrated.cover_image_id, null);
    assert.equal((await db('images').where({ id: 900 }).first()).nsfw_status, 1);
    await db('images').where({ id: 900 }).del();
    await db('albums').where({ id: 90 }).del();

    const group = await db('user_groups').where({ is_default: true }).first();
    await db('users').insert([1, 2, 3].map(id => ({ id, username: `policy-user-${id}`, password_hash: 'unused-test-password-hash', role: id === 1 ? 'admin' : 'user', user_group_id: group.id, review_status: 'approved', is_disabled: false })));
    await db('albums').insert([
      { id: 10, name: 'mixed', user_id: 2, is_public: true, cover_image_id: 102 },
      { id: 11, name: 'unsafe-only', user_id: 2, is_public: true, cover_image_id: 201 },
      { id: 12, name: 'make-private', user_id: 2, is_public: true, all_picture_public: true, hide_from_gallery: true },
      { id: 13, name: 'already-private', user_id: 3, is_private: true },
      { id: 14, name: 'public-safe', user_id: 3, is_public: true }
    ]);
    const imagePath = path.join(directory, 'image.jpg');
    await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffb226' } }).jpeg().toFile(imagePath);
    await fs.mkdir(path.join(directory, '.thumbs'));
    for (const size of ['medium', 'thumb']) await fs.copyFile(imagePath, path.join(directory, '.thumbs', `image_${size}.jpg`));
    const fixtureImages = [
      [101, 10, 2, false], [102, 10, 2, true], [103, 10, 3, true], [104, 10, 2, null],
      [201, 11, 2, true], [301, 12, 2, false], [401, 13, 3, false], [501, 14, 3, false]
    ];
    await db('images').insert(fixtureImages.map(([id, album_id, uploader_id, nsfw_status]) => ({ id, album_id, uploader_id, nsfw_status, filename: `image-${id}.jpg`, path: path.relative(process.cwd(), imagePath), hash_path: `image/2026-11-17/${id.toString(16).padStart(16, '0')}.jpg`, is_public: album_id !== 13, width: 20, height: 20, mime_type: 'image/jpeg', size_bytes: 100 })));
    const token = 'a'.repeat(32);
    const otherToken = 'b'.repeat(32);
    const permissions = JSON.stringify(['images:random', 'albums:random', 'images:read', 'albums:read', 'embed', 'tags:read']);
    await db('api_tokens').insert([{ id: 7, token, user_id: 2, label: 'owner-token', permissions }, { id: 8, token: otherToken, user_id: 3, label: 'other-token', permissions }]);

    const { default: galleryWatcher } = await import('../services/galleryWatcher.js');
    const { default: tagFileWatcher } = await import('../services/tagFileWatcher.js');
    const { default: nsfwService } = await import('../services/nsfwService.js');
    const { default: logger } = await import('../config/logger.js');
    galleryWatcher.startWatching = () => {};
    tagFileWatcher.startWatching = () => {};
    nsfwService.startScheduler = () => {};
    for (const level of ['info', 'warn', 'error']) logger[level] = () => {};
    const { default: app } = await import('../app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const site = await configService.readSiteConfig();
    await configService.writeSiteConfig({ ...site, publicDomain: base, registration: { ...site.registration, privacyMode: false } });
    const sessions = new Map([1, 2, 3].map(id => [id, jwt.sign({ id, role: id === 1 ? 'admin' : 'user' }, process.env.JWT_SECRET, { expiresIn: '10m' })]));
    const request = (url, { userId, apiToken, method = 'GET', body, cookie } = {}) => fetch(new URL(url, base), {
      method, redirect: 'manual', headers: { ...(userId ? { Authorization: `Bearer ${sessions.get(userId)}` } : apiToken ? { Authorization: `Bearer ${apiToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = async (url, options, status = 200) => {
      const response = await request(url, options);
      assert.equal(response.status, status);
      return response.json();
    };

    await suite.test('anonymous random images and albums only expose valid temporary links', async () => {
      for (const query of ['jump', 'jump=1']) {
        const response = await request(`/api/images/random?count=1&pic=md&${query}`);
        assert.equal(response.status, 302);
        const location = response.headers.get('location');
        assert.ok(location.includes('/api/random-media/'));
        const image = await request(location);
        assert.equal(image.status, 200);
        assert.match(image.headers.get('content-type'), /^image\//);
        await image.arrayBuffer();
      }
      const direct = await request('/api/images/random?count=1&jump=0');
      assert.equal(direct.status, 200); assert.match(direct.headers.get('content-type'), /^image\//); await direct.arrayBuffer();
      const images = (await json('/api/images/random?count=100')).images;
      assert.ok(images.length > 1);
      for (const image of images) {
        assert.equal(image.hash_path, undefined); assert.equal(image.path, undefined);
        assert.ok(image.url.includes('tid=0'));
        assert.ok(![102, 103, 201, 401].includes(image.id));
      }
      const albums = (await json('/api/albums/random?count=100')).albums;
      assert.ok(!albums.some(album => album.id === 13));
      for (const album of albums) if (album.cover_image) {
        assert.ok(album.cover_image.url.includes('/api/random-media/'));
        const image = await request(album.cover_image.url); assert.equal(image.status, 200); await image.arrayBuffer();
      }
      const embed = await json('/api/embed/image?random=1&format=source');
      assert.ok(embed.url.includes('/api/random-media/')); assert.equal(embed.image.hash_path, undefined);
      const embeddedImage = await request(embed.url); assert.equal(embeddedImage.status, 200); await embeddedImage.arrayBuffer();
    });

    await suite.test('album contents and counts are filtered before rendering, and covers are always healthy', async () => {
      const guest = await json('/api/internal/albums/10');
      assert.deepEqual(guest.images.map(image => image.id).sort(), [101, 104]); assert.equal(guest.image_count, 2);
      const publicAlbums = await json('/api/albums', { apiToken: token });
      assert.equal(Number(publicAlbums.albums.find(album => album.id === 10).image_count), 2);
      assert.ok([101, 104].includes(guest.cover_image.id));
      const owner = await json('/api/internal/albums/10', { userId: 2 });
      assert.deepEqual(owner.images.map(image => image.id).sort(), [101, 102, 104]);
      const admin = await json('/api/internal/albums/10', { userId: 1 }); assert.equal(admin.images.length, 4);
      const emptyCover = await json('/api/internal/albums/11', { userId: 2 }); assert.equal(emptyCover.cover_image, null); assert.equal(emptyCover.cover_image_id, null);
      await json('/api/admin/albums/10', { userId: 1, method: 'PUT', body: { cover_image_id: 102 } }, 400);
      await json('/api/admin/albums/10', { userId: 2, method: 'PUT', body: { cover_image_id: 501 } }, 400);
      await json('/api/admin/albums/10', { userId: 2, method: 'PUT', body: { cover_image_id: 101 } });
    });

    await suite.test('ordinary users can load only their own full tokens through the internal picker', async () => {
      const response = await request('/api/internal/tokens', { userId: 2 });
      assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
      const data = await response.json(); assert.equal(data.tokens.length, 1); assert.equal(data.tokens[0].token, token);
      const management = await json('/api/admin/api/tokens', { userId: 2 }); assert.equal(management.tokens[0].token, undefined);
      await json('/api/internal/tokens', {}, 401); await json('/api/internal/tokens', { apiToken: token }, 401);
    });

    await suite.test('the reserved my-tags group belongs to the authenticated user, not a numeric group or request parameter', async () => {
      await db('tags').insert({ id: 5, name: 'overlap', display_name: 'overlap', is_public: true });
      await db('user_tags').insert([
        { id: 11, user_id: 2, name: 'overlap', is_public: false },
        { id: 12, user_id: 2, name: 'owner-two', is_public: false },
        { id: 13, user_id: 3, name: 'other-user', is_public: false }
      ]);
      await db('image_tags').insert([
        { image_id: 101, tag_id: -11, user_tag_id: 11, tag_user_id: 2, source: 'manual' },
        { image_id: 301, tag_id: -12, user_tag_id: 12, tag_user_id: 2, source: 'manual' },
        { image_id: 501, tag_id: -13, user_tag_id: 13, tag_user_id: 3, source: 'manual' }
      ]);
      const ownTags = await json('/api/tags', { userId: 2 });
      assert.ok(ownTags.all.some(tag => tag.id === 'u11'));
      const tokenTags = await json('/api/tags', { apiToken: token });
      assert.ok(tokenTags.all.some(tag => tag.id === 'u11'));
      assert.ok(!tokenTags.all.some(tag => tag.id === 'u13'));
      const ownGroups = await json('/api/tag-groups', { userId: 2 });
      assert.deepEqual(ownGroups.groups.find(group => group.id === '__my_tags__').tagIds, ['u11', 'u12']);
      assert.ok(ownGroups.groups.some(group => group.id === '__system'));
      assert.ok(ownGroups.groups.findIndex(group => group.id === '__my_tags__') < ownGroups.groups.findIndex(group => group.id === '__system'));
      const otherGroups = await json('/api/tag-groups', { userId: 3 });
      assert.deepEqual(otherGroups.groups.find(group => group.id === '__my_tags__').tagIds, ['u13']);
      const tokenGroups = await json('/api/tag-groups', { apiToken: token });
      assert.deepEqual(tokenGroups.groups.find(group => group.id === '__my_tags__').tagIds, ['u11', 'u12']);
      assert.ok(!(await json('/api/tag-groups')).groups.some(group => group.id === '__my_tags__'));
      const ownerImages = await json('/api/internal/images?mine=true&tag_g=__my_tags__', { userId: 2 });
      assert.deepEqual(ownerImages.images.map(image => image.id).sort(), [101, 301]);
      const firstTokenImages = await json('/api/images?tag_g=__my_tags__&userId=3', { apiToken: token });
      assert.deepEqual(firstTokenImages.images.map(image => image.id).sort(), [101, 301]);
      const secondTokenImages = await json('/api/images?tag_g=__my_tags__', { apiToken: otherToken });
      assert.deepEqual(secondTokenImages.images.map(image => image.id), [501]);
      const random = await json('/api/images/random?count=2&tag_g=__my_tags__', { apiToken: token });
      assert.deepEqual(random.images.map(image => image.id).sort(), [101, 301]);
      await json('/api/internal/images?tag_g=__my_tags__', {}, 401);
      await json('/api/images?tag_g=__my_tags__', {}, 401);
      await json('/api/images/random?count=2&tag_g=__my_tags__', {}, 401);
    });

    await suite.test('private albums revoke old signed links and reject every conflicting public setting', async () => {
      const old = (await json('/api/images/random?count=2&album=12', { apiToken: token })).images[0];
      const oldAnonymous = (await json('/api/images/random?count=2&album=12')).images[0];
      assert.equal((await request(old.url)).status, 200);
      const updated = await json('/api/admin/albums/12', { userId: 2, method: 'PUT', body: { is_private: true } });
      for (const key of ['is_public', 'all_picture_public', 'hide_from_gallery']) assert.equal(updated[key], 0);
      assert.equal((await db('images').where({ id: 301 }).first()).is_public, 0);
      await json(old.url, {}, 403); await json(oldAnonymous.url, {}, 403);
      for (const key of ['is_public', 'all_picture_public', 'hide_from_gallery']) await json('/api/admin/albums/12', { userId: 2, method: 'PUT', body: { [key]: true } }, 400);
      await json('/api/admin/albums/12/images-public', { userId: 2, method: 'PUT', body: { is_public: true } }, 400);
      await json('/api/admin/images/301', { userId: 2, method: 'PUT', body: { is_public: true } }, 400);
      await json('/api/albums/12', { apiToken: token }, 403);
      await json('/api/images/301', { apiToken: token }, 403);
      await json('/api/embed/image?id=301', { apiToken: token }, 403);
      const visible = await json('/api/images?album=12', { apiToken: token }); assert.equal(visible.images.length, 0);
      const internal = await json('/api/internal/albums/12', { userId: 2 }); assert.equal(internal.images.length, 1);
      await json('/api/internal/albums/12', { userId: 3 }, 403);
      const all = (await json('/api/images/random?count=100', { apiToken: token })).images; assert.ok(!all.some(image => image.id === 301 || image.id === 401));
      const hash = (await db('images').where({ id: 301 }).first()).hash_path;
      await json('/'+hash, {}, 403); await json('/'+hash+'?tk='+token, {}, 403);
      const ownMedia = await request('/'+hash, { cookie: `taotu_token=${sessions.get(2)}` }); assert.equal(ownMedia.status, 200); await ownMedia.arrayBuffer();
    });
    await suite.test('site privacy and health changes revoke previously signed anonymous links', async () => {
      const signed = (await json('/api/images/random?count=2&album=14')).images[0];
      assert.equal((await request(signed.url)).status, 200);
      const current = await configService.readSiteConfig();
      await configService.writeSiteConfig({ ...current, registration: { ...current.registration, privacyMode: true } });
      await new Promise(resolve => setTimeout(resolve, 1100));
      assert.equal((await request(signed.url)).status, 403);
      assert.equal((await request('/api/images/random?count=2')).status, 403);
      await configService.writeSiteConfig({ ...current, registration: { ...current.registration, privacyMode: false } });
      await new Promise(resolve => setTimeout(resolve, 1100));
      await db('images').where({ id: 501 }).update({ nsfw_status: true });
      assert.equal((await request(signed.url)).status, 403);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.destroy();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
