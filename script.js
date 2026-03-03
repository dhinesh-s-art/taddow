const ADMIN = { username: "Claux", password: "13579@clauxx" };
const STORAGE_KEY = "best-sellers-data-v2";

const fallbackId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : fallbackId());

const initialState = {
  isAdmin: false,
  settings: {
    siteName: "Best Sellers",
    pinterestConnected: false,
    pinterestAccount: "",
    intro: "Handpicked best seller products pinned on Pinterest from Amazon, Flipkart, Meesho, and similar platforms."
  },
  products: [
    {
      id: makeId(),
      title: "Smart Kitchen Organizer",
      description: "Popular storage solution seen in home improvement best seller collections.",
      platform: "Amazon",
      tags: "kitchen,home,best seller",
      imageUrl: "https://images.unsplash.com/photo-1584269600519-112d071b4bc7?auto=format&fit=crop&w=900&q=60",
      siteUrl: "https://www.amazon.in",
      pinterestUrl: "https://www.pinterest.com"
    },
    {
      id: makeId(),
      title: "Travel Storage Pouches Set",
      description: "Cartoon-inspired organizer set often pinned for packing hacks and daily travel convenience.",
      platform: "Flipkart",
      tags: "travel,organizer,trending",
      imageUrl: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=60",
      siteUrl: "https://www.flipkart.com",
      pinterestUrl: "https://www.pinterest.com"
    }
  ],
  reactions: {}
};

let state = loadState();
const el = {
  productGrid: document.getElementById("productGrid"),
  searchInput: document.getElementById("searchInput"),
  pinterestStatus: document.getElementById("pinterestStatus"),
  adminPanel: document.getElementById("adminPanel"),
  settingsBox: document.getElementById("settingsBox"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminLoginModal: document.getElementById("adminLoginModal"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  cancelLoginBtn: document.getElementById("cancelLoginBtn")
};

el.adminLoginBtn.addEventListener("click", () => {
  if (state.isAdmin) {
    state.isAdmin = false;
    persist();
    render();
    return;
  }
  el.adminLoginModal.showModal();
});

el.cancelLoginBtn.addEventListener("click", () => el.adminLoginModal.close());

el.adminLoginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = document.getElementById("adminUsername").value.trim();
  const pass = document.getElementById("adminPassword").value;
  if (user === ADMIN.username && pass === ADMIN.password) {
    state.isAdmin = true;
    el.adminLoginModal.close();
    el.adminLoginForm.reset();
    persist();
    render();
  } else {
    alert("Invalid admin credentials.");
  }
});

el.searchInput.addEventListener("input", renderProducts);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw) return structuredClone(initialState);
    return {
      ...initialState,
      ...raw,
      settings: { ...initialState.settings, ...(raw.settings || {}) },
      products: Array.isArray(raw.products) && raw.products.length ? raw.products : structuredClone(initialState.products),
      reactions: raw.reactions && typeof raw.reactions === "object" ? raw.reactions : {}
    };
  } catch {
    return structuredClone(initialState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function visitorId() {
  let id = localStorage.getItem("best-sellers-visitor");
  if (!id) {
    id = makeId();
    localStorage.setItem("best-sellers-visitor", id);
  }
  return id;
}

function safeHttpUrl(url, fallback = "#") {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function ratingAverage(productId) {
  const values = Object.values(state.reactions[productId]?.ratings || {});
  if (!values.length) return "No ratings";
  const avg = values.reduce((a, b) => a + Number(b), 0) / values.length;
  return `⭐ ${avg.toFixed(1)} (${values.length})`;
}

function toggleSet(type, productId) {
  const id = visitorId();
  state.reactions[productId] ??= { likes: {}, wishlist: {}, ratings: {} };
  const bucket = state.reactions[productId][type];
  if (bucket[id]) delete bucket[id];
  else bucket[id] = true;
  persist();
  renderProducts();
}

function setRating(productId, value) {
  const id = visitorId();
  state.reactions[productId] ??= { likes: {}, wishlist: {}, ratings: {} };
  if (Number(value) <= 0) delete state.reactions[productId].ratings[id];
  else state.reactions[productId].ratings[id] = Number(value);
  persist();
  renderProducts();
}

function renderAdmin() {
  el.adminPanel.classList.toggle("hidden", !state.isAdmin);
  el.settingsBox.classList.toggle("hidden", !state.isAdmin);
  el.adminLoginBtn.textContent = state.isAdmin ? "Logout Admin" : "Admin Login";
  if (!state.isAdmin) return;

  el.settingsBox.innerHTML = `
    <h2>Basic Settings</h2>
    <form id="settingsForm" class="form-grid">
      <label>Website Name <input required name="siteName" value="${escapeHtml(state.settings.siteName)}" /></label>
      <label>Pinterest Account <input name="pinterestAccount" value="${escapeHtml(state.settings.pinterestAccount)}" placeholder="username/profile" /></label>
      <label class="full">Intro <textarea name="intro" rows="2">${escapeHtml(state.settings.intro)}</textarea></label>
      <label><input type="checkbox" name="pinterestConnected" ${state.settings.pinterestConnected ? "checked" : ""}/> Pinterest Connected</label>
      <div><button class="btn" type="submit">Save Settings</button></div>
    </form>`;

  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.settings.siteName = String(data.get("siteName") || "").trim() || "Best Sellers";
    state.settings.pinterestAccount = String(data.get("pinterestAccount") || "").trim();
    state.settings.intro = String(data.get("intro") || "").trim();
    state.settings.pinterestConnected = Boolean(data.get("pinterestConnected"));
    persist();
    render();
  });

  el.adminPanel.innerHTML = `
    <h2>Admin Product Manager</h2>
    <form id="addProductForm" class="form-grid">
      <label>Title <input required name="title"></label>
      <label>Platform <input required name="platform" placeholder="Amazon / Flipkart / Meesho"></label>
      <label class="full">Description <textarea name="description" rows="2" required></textarea></label>
      <label>Tags <input name="tags" placeholder="utility, trending"></label>
      <label>Image URL <input required type="url" name="imageUrl" placeholder="https://..."></label>
      <label>Product URL <input required type="url" name="siteUrl" placeholder="Original product link"></label>
      <label>Pinterest Pin URL <input required type="url" name="pinterestUrl" placeholder="https://pinterest.com/pin/..." /></label>
      <div class="full"><button class="btn" type="submit">Add Product</button></div>
    </form>`;

  document.getElementById("addProductForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    state.products.unshift({ id: makeId(), ...data });
    e.target.reset();
    persist();
    renderProducts();
  });
}

function renderProducts() {
  const q = el.searchInput.value.toLowerCase().trim();
  const template = document.getElementById("productTemplate");
  el.productGrid.innerHTML = "";

  state.products
    .filter((p) => [p.title, p.description, p.platform, p.tags].join(" ").toLowerCase().includes(q))
    .forEach((p) => {
      const node = template.content.cloneNode(true);
      const reaction = state.reactions[p.id] || { likes: {}, wishlist: {}, ratings: {} };
      const myId = visitorId();

      const image = node.querySelector(".product-image");
      image.src = safeHttpUrl(p.imageUrl, "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=60");
      image.alt = p.title;
      image.onerror = () => {
        image.src = "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=60";
      };

      node.querySelector(".product-title").textContent = p.title;
      node.querySelector(".product-desc").textContent = p.description;
      node.querySelector(".meta").textContent = `Platform: ${p.platform} • Tags: ${p.tags || "none"}`;
      node.querySelector(".visit-btn").href = safeHttpUrl(p.siteUrl);
      node.querySelector(".pin-btn").href = safeHttpUrl(p.pinterestUrl, "https://www.pinterest.com");

      const likeBtn = node.querySelector(".like-btn");
      likeBtn.textContent = `${reaction.likes[myId] ? "❤️" : "🤍"} Like (${Object.keys(reaction.likes).length})`;
      likeBtn.onclick = () => toggleSet("likes", p.id);

      const wishBtn = node.querySelector(".wishlist-btn");
      wishBtn.textContent = `${reaction.wishlist[myId] ? "✅" : "⭐"} Wishlist (${Object.keys(reaction.wishlist).length})`;
      wishBtn.onclick = () => toggleSet("wishlist", p.id);

      const ratingSelect = node.querySelector(".rating-select");
      ratingSelect.value = reaction.ratings[myId] || 0;
      ratingSelect.onchange = (e) => setRating(p.id, e.target.value);
      node.querySelector(".rating-summary").textContent = ratingAverage(p.id);

      const adminWrap = node.querySelector(".admin-only");
      adminWrap.classList.toggle("hidden", !state.isAdmin);
      if (state.isAdmin) {
        node.querySelector(".edit-btn").onclick = () => editProduct(p.id);
        node.querySelector(".delete-btn").onclick = () => {
          if (!confirm("Delete this product?")) return;
          state.products = state.products.filter((x) => x.id !== p.id);
          delete state.reactions[p.id];
          persist();
          renderProducts();
        };
      }

      el.productGrid.appendChild(node);
    });
}

function editProduct(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const title = prompt("Title", product.title);
  if (!title) return;
  const description = prompt("Description", product.description) || product.description;
  const platform = prompt("Platform", product.platform) || product.platform;
  const tags = prompt("Tags", product.tags || "") || "";
  const imageUrl = prompt("Image URL", product.imageUrl) || product.imageUrl;
  const siteUrl = prompt("Product URL", product.siteUrl) || product.siteUrl;
  const pinterestUrl = prompt("Pinterest URL", product.pinterestUrl) || product.pinterestUrl;
  Object.assign(product, { title, description, platform, tags, imageUrl, siteUrl, pinterestUrl });
  persist();
  renderProducts();
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s]));
}

function render() {
  document.title = state.settings.siteName;
  document.querySelector("h1").textContent = state.settings.siteName;
  document.querySelector(".subtitle").textContent = state.settings.intro;
  el.pinterestStatus.textContent = state.settings.pinterestConnected
    ? `Pinterest: Connected (${state.settings.pinterestAccount || "account set"})`
    : "Pinterest: Not Connected";
  renderAdmin();
  renderProducts();
}

render();
