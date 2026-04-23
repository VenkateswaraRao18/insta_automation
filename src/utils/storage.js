const fs = require("fs");
const { POSTS_DB_PATH } = require("./paths");

function defaultDb() {
  return { posts: [] };
}

function ensureDb() {
  if (!fs.existsSync(POSTS_DB_PATH)) {
    fs.writeFileSync(POSTS_DB_PATH, JSON.stringify(defaultDb(), null, 2), "utf-8");
    return;
  }
  const raw = fs.readFileSync(POSTS_DB_PATH, "utf-8");
  if (!raw.trim()) {
    fs.writeFileSync(POSTS_DB_PATH, JSON.stringify(defaultDb(), null, 2), "utf-8");
  }
}

function getDb() {
  ensureDb();
  const raw = fs.readFileSync(POSTS_DB_PATH, "utf-8").trim();
  if (!raw) {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
  try {
    const db = JSON.parse(raw);
    if (!db || !Array.isArray(db.posts)) {
      const fixed = defaultDb();
      saveDb(fixed);
      return fixed;
    }
    return db;
  } catch {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db) {
  fs.writeFileSync(POSTS_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function topicExists(topic) {
  const db = getDb();
  return db.posts.some((p) => p.topic.toLowerCase() === topic.toLowerCase());
}

function addPost(post) {
  const db = getDb();
  db.posts.push(post);
  saveDb(db);
}

function getPostById(id) {
  const db = getDb();
  return db.posts.find((post) => post.id === id) || null;
}

function updatePostById(id, updateFn) {
  const db = getDb();
  const index = db.posts.findIndex((post) => post.id === id);
  if (index === -1) return null;
  const updated = updateFn(db.posts[index]);
  db.posts[index] = updated;
  saveDb(db);
  return updated;
}

function listPostsRecent(limit = 80) {
  const db = getDb();
  return [...db.posts]
    .sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 80)));
}

module.exports = {
  topicExists,
  addPost,
  getDb,
  getPostById,
  updatePostById,
  listPostsRecent
};
