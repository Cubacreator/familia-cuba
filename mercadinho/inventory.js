(() => {
  const photoFiles = {
    "tablet-infinito":"tablet-infinito","c4":"c4","bandagem":"bandagem","corda":"corda","hack":"hack",
    "alcool-em-gel":"alcool-em-gel","pilula":"pilula","alicate":"alicate","capuz":"capuz","controlador":"controlador",
    "municao-de-tec9":"municao-tec9","tec9":"tec9","abracadeira":"abracadeira","micro-smg":"micro-smg",
    "fn-five-seven":"fn-five-seven","municao-de-mp7":"municao-mp7","municao-de-pistola-hk":"municao-pistola-hk",
    "pistola-hk":"pistola-hk","broca":"broca","furadeira":"furadeira","oculos-de-visao-noturna":"oculos-visao-noturna",
    "pager":"pager","roupa-de-mergulho":"roupa-mergulho","municao-de-fn-five-seven":"municao-fn-five-seven"
  };
  const snapshotKey = "cuba_market_stock_snapshot_v1";
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const photoFor = name => photoFiles[normalize(name)] ? "assets/market/" + photoFiles[normalize(name)] + ".png" : null;
  const escHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const itemByName = name => (SESSION && SESSION.admin ? (ADMIN_ITEMS || []).concat(MARKET_ITEMS || []) : (MARKET_ITEMS || []).concat(ADMIN_ITEMS || [])).find(item => String(item.nome) === String(name));
  const imageMarkup = (name, className) => {
    const src = photoFor(name);
    return src ? '<img class="' + className + '" src="' + src + '" alt="Foto de ' + escHtml(name) + '" loading="lazy">' : '<span class="photoFallback" aria-hidden="true">▦</span>';
  };

  PAGE_TEXT.compras = ["Lista de compras", "Itens que precisam ser repostos no estoque."];

  function drawShoppingList() {
    const host = document.querySelector("#shoppingGrid");
    if (!host) return;
    const rows = (ADMIN_ITEMS || []).filter(item => Number(item.estoque || 0) <= 0)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const count = document.querySelector("#shoppingCount");
    if (count) count.textContent = rows.length + (rows.length === 1 ? " item" : " itens");
    host.innerHTML = rows.length ? rows.map(item =>
      '<article class="shoppingItem">' +
        '<div class="shoppingPhoto">' + imageMarkup(item.nome, "shoppingImage") + '</div>' +
        '<div class="shoppingInfo"><b>' + escHtml(item.nome) + '</b><small>Estoque zerado · precisa de reposição</small></div>' +
        '<span class="shoppingZero">0 un.</span>' +
        '<button class="mini" type="button" data-restock="' + escHtml(item.id) + '">Adicionar estoque</button>' +
      '</article>'
    ).join("") : '<div class="shoppingEmpty"><span>✓</span><b>Nenhum item para comprar</b><small>Os produtos aparecem automaticamente aqui quando o saldo chega a zero.</small></div>';
    host.querySelectorAll("[data-restock]").forEach(button => {
      button.onclick = () => {
        const item = rows.find(row => String(row.id) === button.dataset.restock);
        if (item) openStock(item.id, item.nome);
      };
    });
  }

  function decorateMarket() {
    document.querySelectorAll("#marketGrid .productCard").forEach(card => {
      const title = card.querySelector("h3");
      if (!title) return;
      const name = title.textContent.trim();
      const item = itemByName(name);
      if (!card.querySelector(".productCardLayout")) {
        const content = document.createElement("div");
        content.className = "productCardLayout";
        const visual = document.createElement("div");
        visual.className = "productPhotoWrap";
        visual.innerHTML = imageMarkup(name, "productPhoto");
        const details = document.createElement("div");
        details.className = "productCardInfo";
        Array.from(card.children).forEach(child => details.appendChild(child));
        content.append(visual, details);
        card.appendChild(content);
      }
      const info = card.querySelector(".productCardInfo");
      if (!info) return;
      let quantity = info.querySelector(".stockQuantity");
      if (!quantity) {
        quantity = document.createElement("span");
        quantity.className = "stockQuantity";
        const state = info.querySelector(".state");
        if (state) state.insertBefore(quantity, state.querySelector("button"));
      }
      if (item && item.estoque != null) quantity.textContent = Number(item.estoque).toLocaleString("pt-BR") + " un. disponíveis";
      else if (!quantity.textContent) quantity.textContent = item && item.disponivel ? "Disponível" : "0 un.";
      const state = info.querySelector(".state");
      if (state) state.classList.add("productStockLine");
      const button = info.querySelector(".state .btn");
      if (button) button.textContent = "Retirar item";
    });
  }

  function decorateStockTable() {
    document.querySelectorAll("#stockTable tr").forEach(row => {
      const cell = row.cells && row.cells[0];
      const label = cell && cell.querySelector("b");
      if (!label || cell.querySelector(".stockItemCell")) return;
      const wrap = document.createElement("span");
      wrap.className = "stockItemCell";
      const image = document.createElement("span");
      image.className = "stockTablePhoto";
      image.innerHTML = imageMarkup(label.textContent.trim(), "stockPhoto");
      cell.insertBefore(wrap, label);
      wrap.append(image, label);
    });
  }

  let previousStock = null;
  function checkForEmptyChanges() {
    const rows = ADMIN_ITEMS || [];
    const current = Object.fromEntries(rows.map(item => [item.id, Number(item.estoque || 0)]));
    try { previousStock = JSON.parse(localStorage.getItem(snapshotKey)); } catch (_) { previousStock = null; }
    if (previousStock) {
      const emptied = rows.filter(item => Number(item.estoque || 0) <= 0 && Number(previousStock[item.id]) > 0);
      if (emptied.length) {
        const names = emptied.map(item => item.nome).join(", ");
        toast(emptied.length === 1 ? names + " acabou e entrou na lista de compras." : emptied.length + " produtos acabaram e entraram na lista de compras.");
        if ("Notification" in window && Notification.permission === "granted") {
          emptied.forEach(item => new Notification("Estoque esgotado · Mercadinho Cuba", {
            body: item.nome + " entrou na lista de compras.",
            tag: "mercadinho-" + item.id
          }));
        }
      }
    }
    localStorage.setItem(snapshotKey, JSON.stringify(current));
    previousStock = current;
  }

  const baseMarket = window.renderMarket;
  if (typeof baseMarket === "function") {
    window.renderMarket = function () {
      const result = baseMarket.apply(this, arguments);
      decorateMarket();
      return result;
    };
    const marketSearch = document.querySelector("#marketSearch");
    if (marketSearch) marketSearch.oninput = () => window.renderMarket();
  }
  const baseStock = window.renderStock;
  if (typeof baseStock === "function") {
    window.renderStock = function () {
      const result = baseStock.apply(this, arguments);
      decorateStockTable();
      drawShoppingList();
      checkForEmptyChanges();
      return result;
    };
  }

  const alertButton = document.querySelector("#enableStockAlerts");
  if (alertButton) {
    alertButton.onclick = async () => {
      if (!("Notification" in window)) { toast("Este navegador não permite avisos na área de trabalho."); return; }
      try {
        const result = await Notification.requestPermission();
        if (result === "granted") { alertButton.textContent = "Avisos ativados"; toast("Avisos de estoque ativados neste navegador."); }
        else toast("Os avisos aparecem no painel enquanto ele estiver aberto.");
      } catch (_) { toast("Não foi possível ativar os avisos neste navegador."); }
    };
    if ("Notification" in window && Notification.permission === "granted") alertButton.textContent = "Avisos ativados";
  }

  drawShoppingList();
  window.setInterval(async () => {
    if (SESSION && SESSION.admin && document.visibilityState === "visible") {
      try { await loadMarket(); } catch (error) { console.warn("Falha ao atualizar o estoque", error); }
    }
  }, 45000);
})();