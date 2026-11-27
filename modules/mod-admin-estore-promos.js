/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — E-Store Catalog, Orders, Coupons, Announcements & Footer
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, loading, empty } = GPN.ui;

  async function render(container) {
    let activeTab = 'products';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="products">E-Store Products</button>' +
        '<button type="button" class="gpn-subtab" data-tab="orders">Orders & Coupons</button>' +
        '<button type="button" class="gpn-subtab" data-tab="anns">Announcements</button>' +
        '<button type="button" class="gpn-subtab" data-tab="footer">Dynamic Footer Builder</button>' +
      '</div>' +
      '<div id="epContent">' + loading('Loading...') + '</div>';

    const contentEl = container.querySelector('#epContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    function loadTab() {
      if (activeTab === 'products') return renderProducts(contentEl);
      if (activeTab === 'orders') return renderOrdersCoupons(contentEl);
      if (activeTab === 'anns') return renderAnnouncements(contentEl);
      if (activeTab === 'footer') return renderFooterBuilder(contentEl);
    }

    loadTab();
  }

  /* ---- 1. E-STORE PRODUCTS ---- */
  async function renderProducts(el) {
    el.innerHTML = loading('Loading products...');
    const res = await GPN.api('estore.products.list');
    const list = (res.ok && res.data && res.data.products) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">E-Store Catalog (' + list.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddProd">+ Add Product</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Product</th><th>Category / Class</th><th>MRP / Disc / Final</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
            (list.length
              ? list.map((p) =>
                  '<tr>' +
                    '<td><strong>' + esc(p.Product_ID) + '</strong></td>' +
                    '<td><strong>' + esc(p.Name) + '</strong><div class="gpn-muted">' + esc(p.Tag || '') + '</div></td>' +
                    '<td>' + esc(p.Category) + ' • ' + esc(p.Class || 'All') + '</td>' +
                    '<td>' + formatINR(p.Price) + ' (-' + esc(p.Discount_Pct || 0) + '%) → <strong>' + formatINR(p.Final_Price) + '</strong></td>' +
                    '<td>' + statusBadge(p.Status) + '</td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnEdProd" data-id="' + esc(p.Product_ID) + '">Edit</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No products yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnAddProd').addEventListener('click', () => openProductModal(null, () => renderProducts(el)));
    el.querySelectorAll('.btnEdProd').forEach((b) => {
      b.addEventListener('click', () => {
        const prod = list.find((x) => x.Product_ID === b.dataset.id);
        if (prod) openProductModal(prod, () => renderProducts(el));
      });
    });
  }

  function openProductModal(prod, onSaved) {
    const isEdit = Boolean(prod);
    const p = prod || {};
    openModal(isEdit ? 'Edit Product — ' + p.Product_ID : 'Add E-Store Product',
      '<form id="frmProd">' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Name *</label><input class="gpn-input" id="prName" value="' + esc(p.Name || '') + '" required></div>' +
          '<div class="gpn-field"><label>Category</label><select class="gpn-select" id="prCat">' +
            ['BOOKLET', 'TEST_PACK', 'MATERIAL_PACK', 'COURSE'].map((c) => '<option value="' + c + '"' + (p.Category === c ? ' selected' : '') + '>' + c + '</option>').join('') +
          '</select></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="prClass" value="' + esc(p.Class || '') + '" placeholder="Class 10"></div>' +
          '<div class="gpn-field"><label>MRP (₹) *</label><input class="gpn-input" type="number" id="prPrice" value="' + esc(p.Price || 0) + '" required></div>' +
          '<div class="gpn-field"><label>Discount %</label><input class="gpn-input" type="number" min="0" max="100" id="prDisc" value="' + esc(p.Discount_Pct || 0) + '"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Cover Image URL</label><input class="gpn-input" id="prImg" value="' + esc(p.Image_URL || '') + '" placeholder="https://assets.guidedpathnoida.in/..."></div>' +
          '<div class="gpn-field"><label>R2 Download Path</label><input class="gpn-input" id="prR2" value="' + esc(p.R2_Download_Path || '') + '" placeholder="store/class-10-pack.pdf"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Badge Tag</label><input class="gpn-input" id="prTag" value="' + esc(p.Tag || '') + '" placeholder="Bestseller"></div>' +
          '<div class="gpn-field"><label>Order #</label><input class="gpn-input" type="number" id="prOrd" value="' + esc(p.Display_Order || 1) + '"></div>' +
          (isEdit ? '<div class="gpn-field"><label>Status</label><select class="gpn-select" id="prStat"><option value="ACTIVE"' + (p.Status !== 'INACTIVE' ? ' selected' : '') + '>ACTIVE</option><option value="INACTIVE"' + (p.Status === 'INACTIVE' ? ' selected' : '') + '>INACTIVE</option></select></div>' : '') +
        '</div>' +
        '<div class="gpn-field"><label>Description</label><textarea class="gpn-textarea" id="prDesc">' + esc(p.Description || '') + '</textarea></div>' +
        '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Product</button>' +
      '</form>'
    );

    document.getElementById('frmProd').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        Name: document.getElementById('prName').value.trim(),
        Category: document.getElementById('prCat').value,
        Class: document.getElementById('prClass').value.trim(),
        Price: Number(document.getElementById('prPrice').value || 0),
        Discount_Pct: Number(document.getElementById('prDisc').value || 0),
        Image_URL: document.getElementById('prImg').value.trim(),
        R2_Download_Path: document.getElementById('prR2').value.trim(),
        Tag: document.getElementById('prTag').value.trim(),
        Display_Order: Number(document.getElementById('prOrd').value || 1),
        Description: document.getElementById('prDesc').value.trim()
      };
      if (isEdit) data.Status = document.getElementById('prStat').value;

      const r = isEdit
        ? await GPN.api('estore.products.update', { productId: p.Product_ID, patch: data })
        : await GPN.api('estore.products.create', data);

      if (r.ok) { closeModal(true); toast('Product saved! Final: ' + formatINR(r.data.Final_Price), 'ok'); onSaved(); }
      else toast(r.error, 'err');
    });
  }

  /* ---- 2. ORDERS & COUPONS ---- */
  async function renderOrdersCoupons(el) {
    el.innerHTML = loading('Loading orders & coupons...');
    const [oRes, cRes, pRes] = await Promise.all([
      GPN.api('estore.orders.list'),
      GPN.api('estore.coupons.list'),
      GPN.api('estore.products.list')
    ]);
    const orders = (oRes.ok && oRes.data && oRes.data.orders) || [];
    const coupons = (cRes.ok && cRes.data && cRes.data.coupons) || [];
    const prods = (pRes.ok && pRes.data && pRes.data.products) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Store Orders (' + orders.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewOrd">+ Record Order</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Product</th><th>Paid / Method</th></tr></thead><tbody>' +
            (orders.length
              ? orders.map((o) => '<tr><td><strong>' + esc(o.Order_ID) + '</strong></td><td>' + esc(o.Order_Date) + '</td><td>' + esc(o.Customer_Name) + ' (' + esc(o.Phone) + ')</td><td>' + esc(o.Product_Name) + ' ×' + esc(o.Quantity) + '</td><td><strong>' + formatINR(o.Amount_Paid) + '</strong> • ' + esc(o.Method) + '</td></tr>').join('')
              : '<tr><td colspan="5">' + empty('No orders recorded yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Discount Coupons (' + coupons.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnNewCpn">+ Create Coupon</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Used / Limit</th><th>Status</th></tr></thead><tbody>' +
            (coupons.length
              ? coupons.map((c) => '<tr><td><strong>' + esc(c.Code) + '</strong></td><td>' + esc(c.Value) + (c.Type === 'PERCENT' ? '%' : ' ₹') + '</td><td>' + formatINR(c.Min_Order) + '</td><td>' + esc(c.Used_Count) + ' / ' + esc(c.Usage_Limit || '∞') + '</td><td>' + statusBadge(c.Status) + '</td></tr>').join('')
              : '<tr><td colspan="5">' + empty('No coupons created.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnNewOrd').addEventListener('click', () => {
      openModal('Record Store Order',
        '<form id="frmOrd">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Customer Name *</label><input class="gpn-input" id="odName" required></div>' +
            '<div class="gpn-field"><label>Phone (10-digit)</label><input class="gpn-input" id="odPhone"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>Product *</label><select class="gpn-select" id="odProd" required>' +
            prods.map((p) => '<option value="' + esc(p.Product_ID) + '">' + esc(p.Name) + ' (' + formatINR(p.Final_Price) + ')</option>').join('') +
          '</select></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>Amount Paid (₹)</label><input class="gpn-input" type="number" id="odAmt" placeholder="Defaults to Final Price"></div>' +
            '<div class="gpn-field"><label>Method</label><select class="gpn-select" id="odMeth"><option value="UPI">UPI</option><option value="CASH">CASH</option><option value="RAZORPAY">RAZORPAY</option></select></div>' +
            '<div class="gpn-field"><label>Coupon Code</label><input class="gpn-input" id="odCpn"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Order</button>' +
        '</form>'
      );
      document.getElementById('frmOrd').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amtVal = document.getElementById('odAmt').value;
        const r = await GPN.api('estore.orders.create', {
          Customer_Name: document.getElementById('odName').value.trim(),
          Phone: document.getElementById('odPhone').value.trim(),
          Product_ID: document.getElementById('odProd').value,
          Amount_Paid: amtVal !== '' ? Number(amtVal) : undefined,
          Method: document.getElementById('odMeth').value,
          Coupon_Code: document.getElementById('odCpn').value.trim()
        });
        if (r.ok) {
          closeModal(true);
          if (r.data.Download_URL) {
            openModal('Order Recorded — ' + r.data.Order_ID,
              '<p>Share this R2 download link with the buyer:</p>' +
              '<div class="gpn-alert"><a href="' + esc(r.data.Download_URL) + '" target="_blank" rel="noopener">' + esc(r.data.Download_URL) + '</a></div>'
            );
          } else toast('Order ' + r.data.Order_ID + ' saved.', 'ok');
          renderOrdersCoupons(el);
        } else toast(r.error, 'err');
      });
    });

    el.querySelector('#btnNewCpn').addEventListener('click', () => {
      openModal('Create Coupon',
        '<form id="frmCpn">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Code *</label><input class="gpn-input" id="cpCode" required placeholder="GPN10"></div>' +
            '<div class="gpn-field"><label>Type</label><select class="gpn-select" id="cpType"><option value="PERCENT">PERCENT</option><option value="FLAT">FLAT (₹)</option></select></div>' +
            '<div class="gpn-field"><label>Value *</label><input class="gpn-input" type="number" id="cpVal" required></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Min Order (₹)</label><input class="gpn-input" type="number" id="cpMin" value="0"></div>' +
            '<div class="gpn-field"><label>Usage Limit (0 = unlimited)</label><input class="gpn-input" type="number" id="cpLim" value="0"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Create Coupon</button>' +
        '</form>'
      );
      document.getElementById('frmCpn').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('estore.coupons.create', {
          Code: document.getElementById('cpCode').value.trim(),
          Type: document.getElementById('cpType').value,
          Value: Number(document.getElementById('cpVal').value),
          Min_Order: Number(document.getElementById('cpMin').value || 0),
          Usage_Limit: Number(document.getElementById('cpLim').value || 0)
        });
        if (r.ok) { closeModal(true); toast('Coupon ' + r.data.Code + ' created.', 'ok'); renderOrdersCoupons(el); }
        else toast(r.error, 'err');
      });
    });
  }

  /* ---- 3. ANNOUNCEMENTS ---- */
  async function renderAnnouncements(el) {
    el.innerHTML = loading('Loading announcements...');
    const res = await GPN.api('promos.announcements.list');
    const list = (res.ok && res.data && res.data.announcements) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Portal Announcements (' + list.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddAnn">+ New Announcement</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Title & Message</th><th>Audience</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
            (list.length
              ? list.map((a) =>
                  '<tr>' +
                    '<td>' + esc(a.Ann_ID) + '</td>' +
                    '<td><strong>' + esc(a.Title) + '</strong><div class="gpn-muted">' + esc(a.Message) + '</div></td>' +
                    '<td>' + esc(a.Audience) + '</td>' +
                    '<td>' + statusBadge(a.Status) + '</td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnEdAnn" data-id="' + esc(a.Ann_ID) + '">Edit</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="5">' + empty('No announcements yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    const openAnnModal = (a) => {
      a = a || {};
      openModal(a.Ann_ID ? 'Edit Announcement' : 'New Announcement',
        '<form id="frmAnn">' +
          '<div class="gpn-field"><label>Title *</label><input class="gpn-input" id="anTitle" value="' + esc(a.Title || '') + '" required></div>' +
          '<div class="gpn-field gpn-mt"><label>Message *</label><textarea class="gpn-textarea" id="anMsg" required>' + esc(a.Message || '') + '</textarea></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>CTA Label</label><input class="gpn-input" id="anCtaL" value="' + esc(a.CTA_Label || '') + '" placeholder="View Details"></div>' +
            '<div class="gpn-field"><label>CTA URL</label><input class="gpn-input" id="anCtaU" value="' + esc(a.CTA_URL || '') + '" placeholder="https://..."></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Audience</label><select class="gpn-select" id="anAud">' +
              ['ALL', 'STUDENT', 'PARENT'].map((x) => '<option value="' + x + '"' + (a.Audience === x ? ' selected' : '') + '>' + x + '</option>').join('') +
            '</select></div>' +
            '<div class="gpn-field"><label>Status</label><select class="gpn-select" id="anSt">' +
              '<option value="ACTIVE"' + (a.Status !== 'INACTIVE' ? ' selected' : '') + '>ACTIVE</option>' +
              '<option value="INACTIVE"' + (a.Status === 'INACTIVE' ? ' selected' : '') + '>INACTIVE</option>' +
            '</select></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Announcement</button>' +
        '</form>'
      );
      document.getElementById('frmAnn').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('promos.announcements.save', {
          Ann_ID: a.Ann_ID || '',
          Title: document.getElementById('anTitle').value.trim(),
          Message: document.getElementById('anMsg').value.trim(),
          CTA_Label: document.getElementById('anCtaL').value.trim(),
          CTA_URL: document.getElementById('anCtaU').value.trim(),
          Audience: document.getElementById('anAud').value,
          Status: document.getElementById('anSt').value
        });
        if (r.ok) { closeModal(true); toast('Announcement saved.', 'ok'); renderAnnouncements(el); }
        else toast(r.error, 'err');
      });
    };

    el.querySelector('#btnAddAnn').addEventListener('click', () => openAnnModal(null));
    el.querySelectorAll('.btnEdAnn').forEach((b) => {
      b.addEventListener('click', () => openAnnModal(list.find((x) => x.Ann_ID === b.dataset.id)));
    });
  }

  /* ---- 4. VISUAL DYNAMIC FOOTER BUILDER ---- */
  async function renderFooterBuilder(el) {
    el.innerHTML = loading('Loading footer configuration...');
    const res = await GPN.api('promos.public.bundle');
    const f = (res.ok && res.data && res.data.footer) || {};
    const links = Array.isArray(f.links) ? f.links : [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">Visual Dynamic Footer Builder</h3>' +
        '<p class="gpn-muted">Updates the live footer across Login, Admin, Student/Parent Portal, and E-Store instantly.</p>' +
        '<div class="gpn-form-row gpn-mt">' +
          '<div class="gpn-field"><label>Brand Title</label><input class="gpn-input" id="ftTitle" value="' + esc(f.brandTitle || 'Guided Path Noida') + '"></div>' +
          '<div class="gpn-field"><label>Tagline</label><input class="gpn-input" id="ftTag" value="' + esc(f.tagline || '') + '"></div>' +
        '</div>' +
        '<div class="gpn-field"><label>Copyright Line</label><input class="gpn-input" id="ftCopy" value="' + esc(f.copyright || '') + '"></div>' +
        '<div class="gpn-card-header gpn-mt"><h4 style="margin:0;color:var(--gpn-gold)">Footer Navigation Links</h4><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnAddFtLink">+ Add Link</button></div>' +
        '<div id="ftLinksWrap"></div>' +
        '<button type="button" class="gpn-btn gpn-btn-gold gpn-mt" id="btnSaveFooter">Save Live Footer</button>' +
      '</div>';

    const wrap = el.querySelector('#ftLinksWrap');

    function addLinkRow(label, url) {
      const div = document.createElement('div');
      div.className = 'gpn-toolbar ftLinkRow';
      div.innerHTML =
        '<input class="gpn-input ftL" placeholder="Label" value="' + esc(label || '') + '" style="max-width:200px">' +
        '<input class="gpn-input ftU" placeholder="https://www.guidedpathnoida.in/..." value="' + esc(url || '') + '" style="flex:1;min-width:220px">' +
        '<button type="button" class="gpn-btn gpn-btn-danger gpn-btn-sm">✕</button>';
      div.querySelector('button').addEventListener('click', () => div.remove());
      wrap.appendChild(div);
    }

    links.forEach((l) => addLinkRow(l.label, l.url));
    el.querySelector('#btnAddFtLink').addEventListener('click', () => addLinkRow('', ''));

    el.querySelector('#btnSaveFooter').addEventListener('click', async () => {
      const nextLinks = [];
      wrap.querySelectorAll('.ftLinkRow').forEach((row) => {
        const label = row.querySelector('.ftL').value.trim();
        const url = row.querySelector('.ftU').value.trim();
        if (label && url) nextLinks.push({ label, url });
      });
      const r = await GPN.api('promos.footer.save', {
        brandTitle: el.querySelector('#ftTitle').value.trim(),
        tagline: el.querySelector('#ftTag').value.trim(),
        copyright: el.querySelector('#ftCopy').value.trim(),
        links: nextLinks
      });
      if (r.ok) { toast('Footer updated live!', 'ok'); GPN.initFooter('gpnFooter'); }
      else toast(r.error, 'err');
    });
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-estore-promos'] = { render };
})();
