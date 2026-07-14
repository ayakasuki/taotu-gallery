/**
 * 迁移：JSON 配置迁移到数据库
 * 1. 创建 site_config 表（存储 site.json）
 * 2. 创建 custom_paths 表（存储 paths.json）
 * 3. 从 JSON 文件导入数据到数据库
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function up(knex) {
  // 1. 创建 site_config 表
  const hasSiteConfig = await knex.schema.hasTable('site_config');
  if (!hasSiteConfig) {
    await knex.schema.createTable('site_config', (table) => {
      table.string('key', 100).primary();
      table.json('value').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // 2. 创建 custom_paths 表
  const hasCustomPaths = await knex.schema.hasTable('custom_paths');
  if (!hasCustomPaths) {
    await knex.schema.createTable('custom_paths', (table) => {
      table.increments('id').primary();
      table.string('path', 1000).notNullable();
      table.boolean('recursive').defaultTo(true);
      table.string('album_mode', 20).defaultTo('none');
      table.integer('album_id').nullable();
      table.string('album_name', 200).nullable();
      table.json('tag_ids').nullable();
      table.json('new_tag_names').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // 3. 从 JSON 文件导入数据
  const configDir = path.resolve(__dirname, '../../data/config');

  // 导入 site.json
  const siteFile = path.join(configDir, 'site.json');
  if (fs.existsSync(siteFile)) {
    const siteData = JSON.parse(fs.readFileSync(siteFile, 'utf-8'));
    for (const [key, value] of Object.entries(siteData)) {
      await knex('site_config').insert({
        key,
        value: JSON.stringify(value),
        updated_at: knex.fn.now()
      }).onConflict('key').merge();
    }
    console.log('site.json 已导入 site_config 表');
  }

  // 导入 paths.json
  const pathsFile = path.join(configDir, 'paths.json');
  if (fs.existsSync(pathsFile)) {
    const pathsData = JSON.parse(fs.readFileSync(pathsFile, 'utf-8'));
    if (pathsData.customPaths && Array.isArray(pathsData.customPaths)) {
      for (const cp of pathsData.customPaths) {
        await knex('custom_paths').insert({
          path: cp.path,
          recursive: cp.recursive !== false,
          album_mode: cp.albumMode || 'none',
          album_id: cp.albumId || null,
          album_name: cp.albumName || null,
          tag_ids: cp.tagIds ? JSON.stringify(cp.tagIds) : null,
          new_tag_names: cp.newTagNames ? JSON.stringify(cp.newTagNames) : null
        });
      }
      console.log('paths.json 已导入 custom_paths 表');
    }
  }

  // 确保 tags 表有 is_public 字段
  const hasIsPublic = await knex.schema.hasColumn('tags', 'is_public');
  if (!hasIsPublic) {
    await knex.schema.alterTable('tags', (table) => {
      table.boolean('is_public').defaultTo(true);
    });
  }

  // 确保 conditions 表有 is_public 字段
  const hasCondPublic = await knex.schema.hasColumn('conditions', 'is_public');
  if (!hasCondPublic) {
    await knex.schema.alterTable('conditions', (table) => {
      table.boolean('is_public').defaultTo(false);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('custom_paths');
  await knex.schema.dropTableIfExists('site_config');
}
