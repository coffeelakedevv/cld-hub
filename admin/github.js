// GitHub REST API istemcisi. Tüm istekler tarayıcıdan doğrudan api.github.com'a gider.
// Yayın, Git Data API ile tek commit'tir: yeni görseller, silinen görseller ve catalog.json birlikte.
// Hatalar kodludur (`error.<code>` locales.js'de çevrilir).

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(code, status, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
    this.status = status;
    this.params = { detail, status };
  }
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const encodeUtf8Base64 = (text) => bytesToBase64(new TextEncoder().encode(text));

function decodeUtf8Base64(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

export class GitHubClient {
  constructor({ token = "", owner = "", repo = "", branch = "main", path = "catalog.json" } = {}) {
    Object.assign(this, { token, owner, repo, branch, path });
  }

  async request(method, url, body) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let resp;
    try {
      resp = await fetch(url.startsWith("http") ? url : `${API}${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new GitHubError("gh_offline", 0);
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw errorFor(resp.status, data);
    return data;
  }

  get repoPath() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  /** Repoya yazma iznimiz olup olmadığını doğrular. */
  async checkAccess() {
    const repo = await this.request("GET", this.repoPath);
    if (!repo.permissions?.push) throw new GitHubError("gh_no_push", 403);
    return repo;
  }

  /** Katalog dosyasını okur (`ref`: dal ya da commit). Dosya yoksa `null` döner. */
  async readCatalog(ref = this.branch) {
    try {
      const file = await this.request(
        "GET", `${this.repoPath}/contents/${encodePath(this.path)}?ref=${encodeURIComponent(ref)}`);
      return { text: decodeUtf8Base64(file.content), sha: file.sha };
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /** Değişiklikleri tek commit olarak yazar.
   *  uploads: [{ path, bytes }]; deletions: [path]; expectedSha: kataloğun yüklendiği andaki blob sha'sı.
   *  onProgress(done, total) yükleme adımlarını bildirir. */
  async publish({ catalogText, expectedSha, uploads = [], deletions = [], message, onProgress = () => {} }) {
    const ref = await this.request("GET", `${this.repoPath}/git/ref/heads/${encodePath(this.branch)}`);
    const head = ref.object.sha;
    const current = await this.readCatalog(head);
    if ((current?.sha || null) !== (expectedSha || null)) throw new GitHubError("gh_conflict", 409);

    const commit = await this.request("GET", `${this.repoPath}/git/commits/${head}`);
    const listing = await this.request("GET", `${this.repoPath}/git/trees/${commit.tree.sha}?recursive=1`);
    const existing = new Set((listing.tree || []).filter((e) => e.type === "blob").map((e) => e.path));

    const total = uploads.length + 1;
    let done = 0;
    onProgress(done, total);
    const tree = [];
    for (const { path, bytes } of uploads) {
      // Yol içerik özetini taşır: aynı yolda dosya varsa içerik de aynıdır.
      if (!existing.has(path)) {
        const blob = await this.request("POST", `${this.repoPath}/git/blobs`,
          { content: bytesToBase64(bytes), encoding: "base64" });
        tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      }
      onProgress(++done, total);
    }
    const catalogBlob = await this.request("POST", `${this.repoPath}/git/blobs`,
      { content: encodeUtf8Base64(catalogText), encoding: "base64" });
    tree.push({ path: this.path, mode: "100644", type: "blob", sha: catalogBlob.sha });
    for (const path of deletions) {
      if (existing.has(path)) tree.push({ path, mode: "100644", type: "blob", sha: null });
    }

    const newTree = await this.request("POST", `${this.repoPath}/git/trees`, { base_tree: commit.tree.sha, tree });
    const newCommit = await this.request("POST", `${this.repoPath}/git/commits`,
      { message, tree: newTree.sha, parents: [head] });
    try {
      await this.request("PATCH", `${this.repoPath}/git/refs/heads/${encodePath(this.branch)}`, { sha: newCommit.sha });
    } catch (err) {
      // Bu arada dala başka bir commit geldiyse ileri sarma reddedilir.
      if (err.status === 422) throw new GitHubError("gh_conflict", 409);
      throw err;
    }
    onProgress(total, total);
    return {
      catalogSha: catalogBlob.sha,
      commitUrl: newCommit.html_url || `https://github.com/${this.owner}/${this.repo}/commit/${newCommit.sha}`,
      deleted: deletions.filter((p) => existing.has(p)).length,
    };
  }

  /** Bir uygulama reposunun son sürümleri (en yeni önce). */
  async listReleases(repoFullName, count = 8) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) throw new GitHubError("repo_pattern", 400);
    const list = await this.request(
      "GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${count}`);
    return list.filter((r) => !r.draft);
  }
}

function errorFor(status, data) {
  const detail = data?.message || "";
  const code = { 401: "gh_401", 403: "gh_403", 404: "gh_404", 409: "gh_conflict", 422: "gh_422" }[status] || "gh_other";
  return new GitHubError(code, status, detail);
}
