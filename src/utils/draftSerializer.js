const path = require("path");

function toDraftResponse(post, cacheVersion = Date.now()) {
  return {
    id: post.id,
    topic: post.topic,
    scheduledAt: post.scheduledAt,
    approved: post.approved,
    scores: post.scores,
    feedback: post.feedback,
    content: post.content,
    imagePaths: post.imagePaths,
    imageUrls: (post.imagePaths || []).map(
      (absolutePath) =>
        `/output/${path.basename(path.dirname(absolutePath))}/${path.basename(absolutePath)}?v=${cacheVersion}`
    ),
    buffer: post.buffer || null
  };
}

function toDraftListItem(post, cacheVersion = Date.now()) {
  const paths = post.imagePaths || [];
  const first = paths[0];
  return {
    id: post.id,
    topic: post.topic,
    createdAt: post.createdAt,
    approved: post.approved !== false,
    scoreAverage: post.scores?.average ?? null,
    slideCount: paths.length,
    thumbnailUrl: first
      ? `/output/${path.basename(path.dirname(first))}/${path.basename(first)}?v=${cacheVersion}`
      : null,
    scheduledAt: post.scheduledAt || null,
    bufferScheduled: Boolean(
      post.buffer?.updateId || (post.buffer?.updateIds && post.buffer.updateIds.length > 0)
    )
  };
}

module.exports = { toDraftResponse, toDraftListItem };
