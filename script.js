/* =========================================================
   L'Oréal Routine Builder — script.js (Full Implementation)
   ========================================================= */

// ── DOM References ──────────────────────────────────────────
const categoryFilter       = document.getElementById("categoryFilter");
const productsContainer    = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn          = document.getElementById("generateRoutine");
const chatForm             = document.getElementById("chatForm");
const chatWindow           = document.getElementById("chatWindow");
const userInput            = document.getElementById("userInput");

// ── Cloudflare Worker URL (API key lives there, not here) ───
const WORKER_URL = "https://loreal-proxy.rishiaadi3005-coder.workers.dev";

// ── State ───────────────────────────────────────────────────
let selectedProducts = [];
let conversationHistory = [];
let allProducts = [];

// ── Load saved selections from localStorage ─────────────────
function loadFromStorage() {
  try {
    const saved = localStorage.getItem("lorealSelectedProducts");
    if (saved) {
      selectedProducts = JSON.parse(saved);
    }
  } catch (e) {
    selectedProducts = [];
  }
}

function saveToStorage() {
  localStorage.setItem("lorealSelectedProducts", JSON.stringify(selectedProducts));
}

// ── Render the Selected Products panel ──────────────────────
function renderSelectedPanel() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = '<p class="no-selection">No products selected yet. Browse and click products below!</p>';
  } else {
    selectedProductsList.innerHTML = selectedProducts.map(p => `
      <div class="selected-tag" data-id="${p.id}">
        <span>${p.name}</span>
        <button class="remove-tag" aria-label="Remove ${p.name}" data-id="${p.id}">&times;</button>
      </div>
    `).join("");
  }

  // Clear All button
  const clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) {
    clearBtn.style.display = selectedProducts.length > 0 ? "inline-block" : "none";
  }

  // Remove individual tag listeners
  document.querySelectorAll(".remove-tag").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      selectedProducts = selectedProducts.filter(p => p.id !== id);
      saveToStorage();
      renderSelectedPanel();
      // Update card visual state
      const card = document.querySelector(`.product-card[data-id="${id}"]`);
      if (card) card.classList.remove("selected");
    });
  });
}

// ── Fetch products from JSON ─────────────────────────────────
async function loadProducts() {
  if (allProducts.length > 0) return allProducts;
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

// ── Display product cards ────────────────────────────────────
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = '<div class="placeholder-message">No products found in this category.</div>';
    return;
  }

  productsContainer.innerHTML = products.map(product => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    return `
      <div class="product-card ${isSelected ? 'selected' : ''}" data-id="${product.id}" tabindex="0" role="button" aria-pressed="${isSelected}" aria-label="${product.name}">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="brand">${product.brand}</p>
          <button class="desc-toggle" aria-expanded="false" aria-label="Show description for ${product.name}">Details <i class="fa-solid fa-chevron-down"></i></button>
          <div class="product-desc" hidden>${product.description}</div>
        </div>
        <div class="selected-badge"><i class="fa-solid fa-check"></i></div>
      </div>
    `;
  }).join("");

  // Card click — select/unselect
  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", (e) => {
      // Don't trigger if clicking the description toggle
      if (e.target.closest(".desc-toggle")) return;
      const id = parseInt(card.dataset.id);
      const product = allProducts.find(p => p.id === id);
      const alreadySelected = selectedProducts.some(p => p.id === id);
      if (alreadySelected) {
        selectedProducts = selectedProducts.filter(p => p.id !== id);
        card.classList.remove("selected");
        card.setAttribute("aria-pressed", "false");
      } else {
        selectedProducts.push(product);
        card.classList.add("selected");
        card.setAttribute("aria-pressed", "true");
      }
      saveToStorage();
      renderSelectedPanel();
    });

    // Keyboard support
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Description toggle
  document.querySelectorAll(".desc-toggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const desc = btn.nextElementSibling;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      desc.hidden = expanded;
      btn.setAttribute("aria-expanded", String(!expanded));
      btn.innerHTML = expanded
        ? 'Details <i class="fa-solid fa-chevron-down"></i>'
        : 'Hide <i class="fa-solid fa-chevron-up"></i>';
    });
  });
}

// ── Category filter ──────────────────────────────────────────
categoryFilter.addEventListener("change", async (e) => {
  productsContainer.innerHTML = '<div class="placeholder-message">Loading products...</div>';
  const products = await loadProducts();
  const filtered = products.filter(p => p.category === e.target.value);
  displayProducts(filtered);
});

// ── Add message bubble to chat ───────────────────────────────
function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ── Call AI via Cloudflare Worker ────────────────────────────
async function callAI(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  if (!response.ok) {
    throw new Error(`Worker error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// ── Generate Routine button ──────────────────────────────────
generateBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addMessage("assistant", "Please select at least one product first by browsing the categories below!");
    chatWindow.scrollIntoView({ behavior: "smooth" });
    return;
  }

  const productSummary = selectedProducts.map(p =>
    `- ${p.name} by ${p.brand} (${p.category}): ${p.description}`
  ).join("\n");

  const systemPrompt = `You are a knowledgeable L'Oréal beauty advisor. The user has selected specific products and wants a personalized routine. Provide a clear, step-by-step daily routine (AM and PM if relevant) using ONLY the products they selected. Be warm, specific, and mention each product by name. Format with numbered steps.`;

  const userMessage = `Please create a personalized beauty routine using these selected products:\n\n${productSummary}`;

  // Reset conversation for new routine
  conversationHistory = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
  chatWindow.innerHTML = "";
  addMessage("user", `Generate a routine with my ${selectedProducts.length} selected product${selectedProducts.length > 1 ? 's' : ''}.`);

  try {
    const reply = await callAI(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    addMessage("assistant", reply);
  } catch (err) {
    addMessage("assistant", "Sorry, there was an error generating your routine. Please try again.");
    console.error(err);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
});

// ── Follow-up chat ───────────────────────────────────────────
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = userInput.value.trim();
  if (!message) return;

  if (conversationHistory.length === 0) {
    // No routine generated yet — still allow general questions
    const systemPrompt = `You are a helpful L'Oréal beauty advisor. Answer questions about skincare, haircare, makeup, and L'Oréal products helpfully and warmly.`;
    conversationHistory = [{ role: "system", content: systemPrompt }];
  }

  addMessage("user", message);
  conversationHistory.push({ role: "user", content: message });
  userInput.value = "";

  const sendBtn = chatForm.querySelector("button[type='submit']");
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const reply = await callAI(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    addMessage("assistant", reply);
  } catch (err) {
    addMessage("assistant", "Sorry, I couldn't respond. Please try again.");
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  }
});

// ── Clear All button ─────────────────────────────────────────
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "clearAllBtn") {
    selectedProducts = [];
    saveToStorage();
    renderSelectedPanel();
    // Remove selected class from all visible cards
    document.querySelectorAll(".product-card.selected").forEach(c => {
      c.classList.remove("selected");
      c.setAttribute("aria-pressed", "false");
    });
  }
});

// ── Init ─────────────────────────────────────────────────────
loadFromStorage();
renderSelectedPanel();
// Show placeholder
productsContainer.innerHTML = '<div class="placeholder-message">Select a category to view products</div>';
