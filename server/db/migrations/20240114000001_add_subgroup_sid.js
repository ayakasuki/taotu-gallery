/**
 * 给 tag_groups 的 subgroups 加 sid 字段
 */
export async function up(knex) {
  // 读取现有分组，给每个子分组分配 sid
  const groups = await knex('tag_groups').select('*');
  for (const group of groups) {
    let subgroups = [];
    try {
      subgroups = typeof group.subgroups === 'string' ? JSON.parse(group.subgroups) : (group.subgroups || []);
    } catch { subgroups = []; }

    let changed = false;
    let nextSid = 1;

    // 先找最大的已有 sid
    for (const sg of subgroups) {
      if (sg.sid && sg.sid >= nextSid) nextSid = sg.sid + 1;
    }

    // 给没有 sid 的子分组分配
    for (const sg of subgroups) {
      if (!sg.sid) {
        sg.sid = nextSid++;
        changed = true;
      }
    }

    if (changed) {
      await knex('tag_groups').where({ id: group.id }).update({
        subgroups: JSON.stringify(subgroups)
      });
    }
  }
}

export async function down(knex) {
  // sid 是 JSON 内的字段，不需要回滚
}
