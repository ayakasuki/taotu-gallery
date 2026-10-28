import path from 'path';
import crypto from 'crypto';

function canonicalRelativePath(value, projectRoot) {
  const input = String(value || '').replace(/\\/g, '/');
  const normalized = path.normalize(input);
  const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(projectRoot, normalized);
  return path.relative(projectRoot, absolute).replace(/\\/g, '/');
}

function pathKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function up(knex) {
  if (await knex.schema.hasTable('custom_paths')) {
    const hasIgnoreColumn = await knex.schema.hasColumn('custom_paths', 'ignore_filename_parts');
    if (!hasIgnoreColumn) {
      await knex.schema.alterTable('custom_paths', (table) => {
        table.json('ignore_filename_parts').nullable().comment('扫描时忽略的文件名包含片段');
      });
    }
  }

  if (!(await knex.schema.hasTable('images'))) return;
  const hasPathKey = await knex.schema.hasColumn('images', 'path_key');
  if (!hasPathKey) {
    await knex.schema.alterTable('images', (table) => {
      table.string('path_key', 64).nullable();
    });
  }

  const projectRoot = process.cwd();
  const rows = await knex('images').select('id', 'path');
  const groups = new Map();
  for (const row of rows) {
    const normalizedPath = canonicalRelativePath(row.path, projectRoot);
    const key = pathKey(normalizedPath);
    await knex('images').where({ id: row.id }).update({ path: normalizedPath, path_key: key });
    const ids = groups.get(key) || [];
    ids.push(row.id);
    groups.set(key, ids);
  }

  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const duplicateIds = ids.slice(1);
    await knex('image_tags').whereIn('image_id', duplicateIds).del();
    await knex('images').whereIn('id', duplicateIds).del();
  }

  const indexName = 'uk_images_path_key';
  const indexes = await knex.raw('SHOW INDEX FROM `images` WHERE Key_name = ?', [indexName]);
  if (!indexes[0]?.length) {
    await knex.schema.alterTable('images', (table) => {
      table.unique(['path_key'], indexName);
    });
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('custom_paths') && await knex.schema.hasColumn('custom_paths', 'ignore_filename_parts')) {
    await knex.schema.alterTable('custom_paths', (table) => table.dropColumn('ignore_filename_parts'));
  }
  if (await knex.schema.hasTable('images') && await knex.schema.hasColumn('images', 'path_key')) {
    await knex.schema.alterTable('images', (table) => table.dropColumn('path_key'));
  }
}
