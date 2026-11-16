export function albumPolicyError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isUnsafeImage(image) {
  return image?.nsfw_status === true || image?.nsfw_status === 1 || image?.nsfw_status === '1';
}

export function albumPrivacyUpdates(input, current = {}) {
  const updates = {};
  for (const key of ['is_private', 'is_public', 'all_picture_public', 'hide_from_gallery']) {
    if (input[key] === undefined) continue;
    if (![true, false, 0, 1].includes(input[key])) throw albumPolicyError('相册开关参数必须为布尔值');
    updates[key] = !!input[key];
  }
  const isPrivate = updates.is_private ?? !!current.is_private;
  if (isPrivate) {
    for (const key of ['is_public', 'all_picture_public', 'hide_from_gallery']) {
      if (updates[key]) throw albumPolicyError('非法请求：私密相册不能开启公开相册、公开所有图片或隐藏于主页图库');
      updates[key] = false;
    }
  }
  return updates;
}

export function filterHealthyImages(query, prefix = '') {
  const field = `${prefix}nsfw_status`;
  return query.where(builder => builder.whereNull(field).orWhere(field, false));
}

export function filterAlbumImagesForViewer(query, { userId = null, isAdmin = false } = {}, prefix = '') {
  if (isAdmin) return query;
  return query.where(builder => {
    filterHealthyImages(builder, prefix);
    if (userId) builder.orWhere(`${prefix}uploader_id`, userId);
  });
}

export function filterPrivateAlbumImages(query, { userId = null, isAdmin = false, external = false } = {}, database, prefix = 'images.') {
  if (isAdmin && !external) return query;
  return query.where(builder => {
    builder.whereNull(`${prefix}album_id`)
      .orWhereNotIn(`${prefix}album_id`, database('albums').select('id').where({ is_private: true }));
    if (userId && !external) {
      builder.orWhereIn(`${prefix}album_id`, database('albums').select('id').where({ is_private: true, user_id: userId }));
    }
  });
}
