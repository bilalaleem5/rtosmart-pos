// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    // Current Date formatting
    const updateDateTime = () => {
        const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
        const dateString = new Date().toLocaleDateString('en-US', dateOptions);
        document.getElementById('current-date').textContent = dateString;
    };
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // --- Global State ---
    const state = {
        locations: [],
        currentLocation: null,
        cart: [],
        products: []
    };

    const locDropdown = document.getElementById('store-location');
    const ordersLocDropdown = document.getElementById('orders-location-filter');
    const reportsLocFilter = document.getElementById('report-loc-filter');
    const cartLocDisplay = document.getElementById('cart-location-display');
    const loadingOverlay = document.getElementById('app-loading');
    const tabContents = document.querySelectorAll('.tab-content');
    const navLinks = document.querySelectorAll('.nav-links li');

    // --- Initialization ---
    async function initApp() {
        try {
            await fetchLocations();
            if (state.locations.length > 0) {
                state.currentLocation = state.locations[0];
                renderLocationDropdowns();
                updateCartLocationDisplay();
                await fetchProductsForCurrentLocation();
            }

            // Hide loading screen
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 800);

            renderCart();

        } catch (error) {
            console.error("Failed to initialize app:", error);
            alert("Could not connect to backend server. Ensure server.js is running.");
        }
    }

    // --- Locations Logic ---
    async function fetchLocations() {
        const res = await fetch('/api/locations');
        state.locations = await res.json();
    }

    function renderLocationDropdowns() {
        locDropdown.innerHTML = '';
        ordersLocDropdown.innerHTML = '<option value="all">All Locations</option>';
        reportsLocFilter.innerHTML = '<option value="all">All Locations</option>'; // New: Populate reports filter

        state.locations.forEach(loc => {
            // Main Topbar Dropdown
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            if (state.currentLocation && loc.id === state.currentLocation.id) opt.selected = true;
            locDropdown.appendChild(opt);

            // Orders Filter Dropdown
            const filterOpt = document.createElement('option');
            filterOpt.value = loc.id;
            filterOpt.textContent = loc.name;
            ordersLocDropdown.appendChild(filterOpt);

            // New: Reports Filter Dropdown
            const reportFilterOpt = document.createElement('option');
            reportFilterOpt.value = loc.id;
            reportFilterOpt.textContent = loc.name;
            reportsLocFilter.appendChild(reportFilterOpt);
        });
    }

    locDropdown.addEventListener('change', async (e) => {
        const locId = parseInt(e.target.value);
        state.currentLocation = state.locations.find(l => l.id === locId);
        updateCartLocationDisplay();

        // Clear cart when changing location
        if (state.cart.length > 0) {
            if (confirm("Changing locations will clear your current cart. Continue?")) {
                state.cart = [];
                renderCart();
            } else {
                // Revert selection
                locDropdown.value = state.cart[0].location_id || state.currentLocation.id;
                return;
            }
        }

        // Fetch new products
        loadingOverlay.classList.remove('hidden');
        await fetchProductsForCurrentLocation();
        loadingOverlay.classList.add('hidden');
    });

    function updateCartLocationDisplay() {
        cartLocDisplay.textContent = state.currentLocation ? state.currentLocation.name : '--';
    }

    // --- Modal Logic (Locations) ---
    const addLocBtn = document.getElementById('add-location-btn');
    const addLocModal = document.getElementById('add-location-modal');
    const saveLocBtn = document.getElementById('save-location-btn');
    // Common modal close
    const closeBtns = document.querySelectorAll('.close-modal');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    addLocBtn.addEventListener('click', () => addLocModal.classList.remove('hidden'));

    saveLocBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-loc-name').value;
        const address = document.getElementById('new-loc-address').value;
        if (!name) return alert("Store Name is required");

        const res = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address })
        });

        if (res.ok) {
            const newLoc = await res.json();
            state.locations.push(newLoc);
            state.currentLocation = newLoc;
            renderLocationDropdowns();
            updateCartLocationDisplay();
            addLocModal.classList.add('hidden');

            // Re-fetch products (will be empty for new location)
            await fetchProductsForCurrentLocation();
        }
    });

    // --- Tab Switching Logic ---
    function switchTab(targetTab) {
        navLinks.forEach(l => {
            if (l.getAttribute('data-tab') === targetTab) l.classList.add('active');
            else l.classList.remove('active');
        });

        tabContents.forEach(content => content.classList.add('hidden'));

        const selectedTab = document.getElementById(`${targetTab}-tab`);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');

            // Trigger Data Fetches based on tab
            if (targetTab === 'orders') fetchOrders();
            if (targetTab === 'inventory') fetchInventory();
            if (targetTab === 'customers') fetchCustomers();
            if (targetTab === 'purchasing') fetchPurchasing();
            if (targetTab === 'reports') fetchReports();
        } else {
            document.getElementById('placeholder-tab').classList.remove('hidden');
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => switchTab(link.getAttribute('data-tab')));
    });

    // --- Register / Products Logic ---
    const productsGrid = document.getElementById('products-grid');

    async function fetchProductsForCurrentLocation() {
        if (!state.currentLocation) return;
        const res = await fetch(`/api/products/location/${state.currentLocation.id}`);
        state.products = await res.json();
        renderProducts();
    }

    function renderProducts(category = 'All') {
        productsGrid.innerHTML = '';

        const filteredProducts = category === 'All'
            ? state.products
            : state.products.filter(p => p.category === category);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">No products found for this location.</div>`;
            return;
        }

        filteredProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card fade-in';

            const iconHtml = product.icon && (product.icon.startsWith('http') || product.icon.startsWith('data:'))
                ? `<img src="${product.icon}" style="width:100%; height:100%; object-fit:contain; padding:10px;" alt="Product">`
                : `<i class="fa-solid ${product.icon || 'fa-box'}"></i>`;

            card.innerHTML = `
                <div class="product-img">
                    ${iconHtml}
                </div>
                <div class="product-info">
                    <div class="product-sku">${product.sku}</div>
                    <div class="product-name">${product.name}</div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto;">
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">In Stock: ${product.stock}</div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => addToCart(product));
            productsGrid.appendChild(card);
        });
    }

    const categoryChips = document.querySelectorAll('.category-chip');
    categoryChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            categoryChips.forEach(c => c.classList.remove('active'));
            const target = e.target;
            target.classList.add('active');
            renderProducts(target.textContent);
        });
    });

    // --- Cart Logic ---
    const cartItemsContainer = document.getElementById('cart-items');

    function addToCart(product) {
        const existingItem = state.cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.qty += 1;
        } else {
            state.cart.push({ ...product, qty: 1 });
        }
        renderCart();
    }

    function updateQty(id, delta) {
        const item = state.cart.find(i => i.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty <= 0) state.cart = state.cart.filter(i => i.id !== id);
            renderCart();
        }
    }

    function renderCart() {
        if (state.cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-message">
                    <div class="empty-icon-circle"><i class="fa-solid fa-cart-arrow-down"></i></div>
                    <p>No items in cart</p>
                    <span>Scan or click products to add</span>
                </div>
            `;
        } else {
            cartItemsContainer.innerHTML = '';
            state.cart.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                itemEl.innerHTML = `
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-controls">
                            <button class="qty-btn minus" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                            <span class="qty-val">${item.qty}</span>
                            <button class="qty-btn plus" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <div class="cart-item-price">
                        <span>$${(item.price * item.qty).toFixed(2)}</span>
                        <span class="remove-item" data-id="${item.id}" title="Remove Item"><i class="fa-solid fa-trash-can"></i></span>
                    </div>
                `;
                cartItemsContainer.appendChild(itemEl);
            });

            // Bind events
            cartItemsContainer.querySelectorAll('.minus').forEach(btn => btn.addEventListener('click', (e) => updateQty(parseInt(e.currentTarget.dataset.id), -1)));
            cartItemsContainer.querySelectorAll('.plus').forEach(btn => btn.addEventListener('click', (e) => updateQty(parseInt(e.currentTarget.dataset.id), 1)));
            cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.dataset.id);
                    state.cart = state.cart.filter(i => i.id !== id);
                    renderCart();
                });
            });
        }
        updateTotals();
    }

    let selectedPaymentMethod = null;
    const paymentBtns = [
        document.getElementById('btn-cash'),
        document.getElementById('btn-card'),
        document.getElementById('btn-other')
    ];

    paymentBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            paymentBtns.forEach(b => {
                b.style.opacity = '0.5';
                b.style.transform = 'scale(0.95)';
            });
            const target = e.currentTarget;
            target.style.opacity = '1';
            target.style.transform = 'scale(1)';
            selectedPaymentMethod = target.textContent.trim();
        });
    });

    function updateTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * 0.08;
        const total = subtotal + tax;

        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;
        document.getElementById('due').textContent = `$${total.toFixed(2)}`;

        const btnComplete = document.getElementById('btn-complete');
        if (state.cart.length === 0) {
            btnComplete.style.opacity = '0.5';
            btnComplete.style.cursor = 'not-allowed';
            btnComplete.onclick = (e) => { e.preventDefault() };
        } else {
            btnComplete.style.opacity = '1';
            btnComplete.style.cursor = 'pointer';
            btnComplete.onclick = checkout;
        }

        // Reset payment selection visually if cart is empty
        if (state.cart.length === 0) {
            selectedPaymentMethod = null;
            paymentBtns.forEach(b => { b.style.opacity = '1'; b.style.transform = 'scale(1)'; });
        }
    }

    async function checkout() {
        if (state.cart.length === 0) return;
        if (!selectedPaymentMethod) return alert("Please select a payment method (Cash, Card, etc)");

        const customerPhoneOrEmail = document.getElementById('cart-customer-contact').value.trim();
        const customerName = document.getElementById('cart-customer-name').value.trim();
        let customerId = null;

        // Auto-create/find customer if info provided
        if (customerPhoneOrEmail || customerName) {
            try {
                const cRes = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: customerName || 'Walk-in',
                        phone: customerPhoneOrEmail, // Just treating the input as phone/email mix
                        email: customerPhoneOrEmail.includes('@') ? customerPhoneOrEmail : '',
                        group_type: 'Retail'
                    })
                });
                if (cRes.ok) {
                    const custData = await cRes.json();
                    customerId = custData.id;
                }
            } catch (e) {
                console.error("Error creating customer on checkout", e);
            }
        }

        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * 0.08;
        const total = subtotal + tax;

        const payload = {
            location_id: state.currentLocation.id,
            customer_id: customerId,
            subtotal,
            tax,
            total,
            status: "Completed",
            items: state.cart.map(i => ({ id: i.id, qty: i.qty, price: i.price }))
        };

        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('Order Completed Successfully! Total: $' + total.toFixed(2));
            state.cart = [];
            document.getElementById('cart-customer-name').value = '';
            document.getElementById('cart-customer-contact').value = '';
            renderCart();
            fetchProductsForCurrentLocation();
        } else {
            alert('Error completing order.');
        }
    }

    // --- Other Tabs Logic ---

    async function fetchOrders() {
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

        const res = await fetch('/api/orders');
        const orders = await res.json();

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-icon-wrapper"><i class="fa-regular fa-folder-open"></i></div><p>No orders found.</p></td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(o => {
            const date = new Date(o.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:var(--bg-hover); color:var(--text-main)">#${1000 + o.id}</span></td>
                    <td>Walk-in Customer</td>
                    <td>${date}</td>
                    <td><span class="badge badge-success">${o.status}</span></td>
                    <td>RTOSmart POS</td>
                    <td style="font-weight:700;">$${o.total.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    // --- Inventory Adding/Editing Logic ---
    const addProductBtn = document.getElementById('open-add-product');
    const addProductModal = document.getElementById('add-product-modal');
    const saveProductBtn = document.getElementById('save-product-btn');

    // Edit Product Logic
    const editProductModal = document.getElementById('edit-product-modal');
    const updateProductBtn = document.getElementById('update-product-btn');

    addProductBtn.addEventListener('click', () => {
        addProductModal.dataset.mode = 'add';
        addProductModal.dataset.editId = '';
        saveProductBtn.textContent = "Add Product";

        // Reset form
        document.querySelectorAll('#add-product-modal input, #add-product-modal textarea').forEach(el => {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        });

        addProductModal.classList.remove('hidden');
        // Reset tabs to first tab on open
        document.querySelectorAll('#add-product-modal .modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#add-product-modal .modal-tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('#add-product-modal .modal-tab[data-tab="prod-details"]').classList.add('active');
        document.getElementById('prod-details').classList.add('active');
    });

    // Tab Switching Logic
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            const modal = tab.closest('.modal-content');

            // Deactivate all in this modal
            modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

            // Activate selected
            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    saveProductBtn.addEventListener('click', async () => {
        const payload = {
            name: document.getElementById('new-prod-name').value,
            sku: document.getElementById('new-prod-sku').value,
            upc: document.getElementById('new-prod-upc').value,
            mrf_id: document.getElementById('new-prod-mrf').value,
            alternate_lookups: document.getElementById('new-prod-alt').value,
            category: document.getElementById('new-prod-category').value,
            manufacturer: document.getElementById('new-prod-manufacturer').value,
            make: document.getElementById('new-prod-make').value,
            model: document.getElementById('new-prod-model').value,
            year: document.getElementById('new-prod-year').value,
            stock: parseInt(document.getElementById('new-prod-stock').value) || 0,
            reorder_point: parseInt(document.getElementById('new-prod-reorder').value) || 0,
            desired_stock: parseInt(document.getElementById('new-prod-desired').value) || 0,
            default_cost: parseFloat(document.getElementById('new-prod-cost').value) || 0,
            price: parseFloat(document.getElementById('new-prod-price').value) || 0,
            sale_price: parseFloat(document.getElementById('new-prod-sale').value) || null,
            icon: document.getElementById('new-prod-icon').value,
            short_desc: document.getElementById('new-prod-short-desc').value,
            long_desc: document.getElementById('new-prod-long-desc').value,
            show_web_price: document.getElementById('new-prod-show-price').checked,
            show_add_to_cart: document.getElementById('new-prod-show-cart').checked,
            unlimited_web: document.getElementById('new-prod-unlimited').checked,
            track_serial: document.getElementById('new-prod-track-serial').checked,
            weight: parseFloat(document.getElementById('new-prod-weight').value) || 0,
            height: parseFloat(document.getElementById('new-prod-height').value) || 0,
            width: parseFloat(document.getElementById('new-prod-width').value) || 0,
            length: parseFloat(document.getElementById('new-prod-length').value) || 0,
            unit_type: document.getElementById('new-prod-unit').value,
            tax_code: document.getElementById('new-prod-taxcode').value,
            cost_depreciation: document.getElementById('new-prod-depreciation').value,
            is_kit: document.getElementById('new-prod-kit').checked,
            commissionable: document.getElementById('new-prod-commission').checked,
            is_digital: document.getElementById('new-prod-digital').checked,
            location_id: state.currentLocation.id
        };

        if (!payload.sku || !payload.name || !payload.price) return alert("Please fill at least the Product Title, SKU, and Price in the Details tab.");

        const isEdit = addProductModal.dataset.mode === 'edit';
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/products/${addProductModal.dataset.editId}` : '/api/products';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            addProductModal.classList.add('hidden');
            fetchInventory();
            fetchProductsForCurrentLocation();
        } else {
            const errData = await res.json().catch(() => ({}));
            let errMsg = errData.error || res.statusText;
            if (errMsg.includes('UNIQUE constraint failed: products.sku')) {
                errMsg = "The SKU you entered is already in use by another product! Please change the SKU to make it unique.";
            }
            alert("Failed to save product: " + errMsg);
        }
    });

    async function fetchInventory() {
        const tbody = document.getElementById('inventory-table-body');
        const res = await fetch('/api/products');
        const products = await res.json();

        tbody.innerHTML = '';
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge" style="background:#f1f5f9; color:#475569">${p.sku}</span></td>
                <td style="font-weight:600;">${p.name}</td>
                <td>${p.category}</td>
                <td>${state.locations.find(l => l.id === p.location_id)?.name || 'Unknown'}</td>
                <td style="font-weight:700;">$${p.price.toFixed(2)}</td>
                <td>
                    <span class="badge ${p.stock < 10 ? 'badge-warning' : 'badge-success'}">${p.stock} Units</span>
                </td>
                <td><button class="icon-btn-small edit-item-btn" data-fullprod='${JSON.stringify(p).replace(/'/g, "&apos;")}'> <i class="fa-solid fa-pen"></i></button></td>
            `;
            tbody.appendChild(tr);
        });

        // Bind Edit buttons
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const b = e.currentTarget;
                const pInfo = JSON.parse(b.dataset.fullprod);

                addProductModal.dataset.mode = 'edit';
                addProductModal.dataset.editId = pInfo.id;
                saveProductBtn.textContent = "Save Changes";

                // Populate fields
                document.getElementById('new-prod-name').value = pInfo.name || '';
                document.getElementById('new-prod-sku').value = pInfo.sku || '';
                document.getElementById('new-prod-upc').value = pInfo.upc || '';
                document.getElementById('new-prod-mrf').value = pInfo.mrf_id || '';
                document.getElementById('new-prod-alt').value = pInfo.alternate_lookups || '';
                if (pInfo.category) document.getElementById('new-prod-category').value = pInfo.category;
                document.getElementById('new-prod-manufacturer').value = pInfo.manufacturer || '';
                document.getElementById('new-prod-make').value = pInfo.make || '';
                document.getElementById('new-prod-model').value = pInfo.model || '';
                document.getElementById('new-prod-year').value = pInfo.year || '';
                document.getElementById('new-prod-stock').value = pInfo.stock || 0;
                document.getElementById('new-prod-reorder').value = pInfo.reorder_point || 0;
                document.getElementById('new-prod-desired').value = pInfo.desired_stock || 0;
                document.getElementById('new-prod-cost').value = pInfo.default_cost || 0;
                document.getElementById('new-prod-price').value = pInfo.price || 0;
                document.getElementById('new-prod-sale').value = pInfo.sale_price || '';
                document.getElementById('new-prod-icon').value = pInfo.icon || '';
                document.getElementById('new-prod-short-desc').value = pInfo.short_desc || '';
                document.getElementById('new-prod-long-desc').value = pInfo.long_desc || '';

                document.getElementById('new-prod-show-price').checked = pInfo.show_web_price ? true : false;
                document.getElementById('new-prod-show-cart').checked = pInfo.show_add_to_cart ? true : false;
                document.getElementById('new-prod-unlimited').checked = pInfo.unlimited_web ? true : false;
                document.getElementById('new-prod-track-serial').checked = pInfo.track_serial ? true : false;

                document.getElementById('new-prod-weight').value = pInfo.weight || 0;
                document.getElementById('new-prod-height').value = pInfo.height || 0;
                document.getElementById('new-prod-width').value = pInfo.width || 0;
                document.getElementById('new-prod-length').value = pInfo.length || 0;

                if (pInfo.unit_type) document.getElementById('new-prod-unit').value = pInfo.unit_type;
                document.getElementById('new-prod-taxcode').value = pInfo.tax_code || '';
                if (pInfo.cost_depreciation) document.getElementById('new-prod-depreciation').value = pInfo.cost_depreciation;

                document.getElementById('new-prod-kit').checked = pInfo.is_kit ? true : false;
                document.getElementById('new-prod-commission').checked = pInfo.commissionable ? true : false;
                document.getElementById('new-prod-digital').checked = pInfo.is_digital ? true : false;

                // Reset tabs to details
                document.querySelectorAll('#add-product-modal .modal-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#add-product-modal .modal-tab-content').forEach(c => c.classList.remove('active'));
                document.querySelector('#add-product-modal .modal-tab[data-tab="prod-details"]').classList.add('active');
                document.getElementById('prod-details').classList.add('active');

                addProductModal.classList.remove('hidden');
            });
        });
    }

    // Connect image upload button
    const btnUploadComputer = document.getElementById('btn-upload-computer');
    const prodImageUpload = document.getElementById('prod-image-upload');
    if (btnUploadComputer && prodImageUpload) {
        btnUploadComputer.addEventListener('click', () => {
            prodImageUpload.click();
        });
        prodImageUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function (event) {
                    document.getElementById('new-prod-icon').value = event.target.result;
                    alert(`Successfully attached ${file.name}!`);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- Customer Adding Logic ---
    const addCustomerBtn = document.getElementById('open-add-customer');
    const addCustomerModal = document.getElementById('add-customer-modal');
    const saveCustomerBtn = document.getElementById('save-customer-btn');

    addCustomerBtn.addEventListener('click', () => addCustomerModal.classList.remove('hidden'));

    saveCustomerBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-cust-name').value;
        const contact = document.getElementById('new-cust-contact').value;
        const group_type = document.getElementById('new-cust-group').value;

        if (!name) return alert("Name is required");

        const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                phone: contact,
                email: contact.includes('@') ? contact : '',
                group_type
            })
        });

        if (res.ok) {
            addCustomerModal.classList.add('hidden');
            fetchCustomers();
            document.getElementById('new-cust-name').value = '';
            document.getElementById('new-cust-contact').value = '';
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("Failed to save customer: " + (errData.error || res.statusText));
        }
    });

    async function fetchCustomers() {
        const tbody = document.getElementById('customers-table-body');
        const res = await fetch('/api/customers');
        const customers = await res.json();

        tbody.innerHTML = '';
        customers.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${c.name}</td>
                    <td>${c.email || 'N/A'}</td>
                    <td>${c.phone || 'N/A'}</td>
                    <td><span class="badge" style="background:var(--primary-light); color:var(--primary)">${c.group_type}</span></td>
                    <td style="font-weight:700; color:var(--emerald);">$${c.total_spent.toFixed(2)}</td>
                    <td><button class="icon-btn-small"><i class="fa-solid fa-eye"></i></button></td>
                </tr>
            `;
        });
    }

    // --- Vendor & Purchasing Logic ---
    const addVendorBtn = document.getElementById('open-add-vendor');
    const addVendorModal = document.getElementById('add-vendor-modal');
    const saveVendorBtn = document.getElementById('save-vendor-btn');

    addVendorBtn.addEventListener('click', () => addVendorModal.classList.remove('hidden'));

    saveVendorBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-vend-name').value;
        const contact_info = document.getElementById('new-vend-contact').value;
        const address = document.getElementById('new-vend-address').value;
        const notes = document.getElementById('new-vend-notes').value;
        if (!name) return alert("Required field missing");

        const res = await fetch('/api/vendors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact_info, address, notes })
        });
        if (res.ok) {
            addVendorModal.classList.add('hidden');
            fetchPurchasing();
            document.getElementById('new-vend-name').value = '';
            document.getElementById('new-vend-contact').value = '';
            document.getElementById('new-vend-address').value = '';
            document.getElementById('new-vend-notes').value = '';
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("Failed to save vendor: " + (errData.error || res.statusText));
        }
    });

    const addPoBtn = document.getElementById('open-add-po');
    const addPoModal = document.getElementById('add-po-modal');
    const savePoBtn = document.getElementById('save-po-btn');

    addPoBtn.addEventListener('click', () => addPoModal.classList.remove('hidden'));

    savePoBtn.addEventListener('click', async () => {
        const payload = {
            vendor_id: parseInt(document.getElementById('new-po-vendor').value),
            location_id: state.currentLocation ? state.currentLocation.id : 1, // Fallback
            po_number: document.getElementById('new-po-number').value,
            tracking_number: document.getElementById('new-po-tracking').value,
            ship_date: document.getElementById('new-po-ship-date').value,
            cancel_date: document.getElementById('new-po-cancel-date').value,
            expected_delivery: document.getElementById('new-po-expected').value,
            notes: document.getElementById('new-po-notes').value,
            freight_cost: parseFloat(document.getElementById('new-po-freight').value) || 0,
            discount_amount: parseFloat(document.getElementById('new-po-discount').value) || 0,
            total: parseFloat(document.getElementById('new-po-total').value) || 0
        };

        const res = await fetch('/api/purchasing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            addPoModal.classList.add('hidden');
            fetchPurchasing();
            // Clear main fields
            document.getElementById('new-po-total').value = '';
            document.getElementById('new-po-expected').value = '';
            document.getElementById('new-po-notes').value = '';
            document.getElementById('new-po-tracking').value = '';
            document.getElementById('new-po-number').value = '';
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("Failed to save PO: " + (errData.error || res.statusText));
        }
    });

    async function fetchPurchasing() {
        // Vendors
        const vRes = await fetch('/api/vendors');
        const vendors = await vRes.json();
        const vBody = document.getElementById('vendors-table-body');
        const poVendorSelect = document.getElementById('new-po-vendor');
        vBody.innerHTML = '';
        poVendorSelect.innerHTML = '';

        vendors.forEach(v => {
            vBody.innerHTML += `<tr><td style="font-weight:600">${v.name}</td><td>${v.contact_info}</td></tr>`;
            poVendorSelect.innerHTML += `<option value="${v.id}">${v.name}</option>`;
        });

        // Purchase Orders
        const tbody = document.getElementById('purchasing-table-body');
        const res = await fetch('/api/purchasing');
        const pos = await res.json();

        tbody.innerHTML = '';
        pos.forEach(po => {
            const badgeClass = po.status === 'Received' ? 'badge-success' : 'badge-warning';
            const actionBtn = po.status === 'Pending'
                ? `<button class="btn btn-outline border-emerald text-emerald receive-po-btn" data-id="${po.id}" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-check"></i> Receive</button>`
                : `<i class="fa-solid fa-check-circle" style="color:var(--emerald);"></i>`;

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${po.vendor_name}</td>
                    <td><span class="badge ${badgeClass}">${po.status}</span></td>
                    <td style="font-weight:700;">$${po.total.toFixed(2)}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });

        // Bind receive buttons
        document.querySelectorAll('.receive-po-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                await fetch(`/api/purchasing/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Received' })
                });
                fetchPurchasing();
            });
        });
    }

    let salesChartInstance = null;
    let categoryChartInstance = null;
    let hourlyChartInstance = null;

    async function fetchReports() {
        const filterVal = document.getElementById('report-loc-filter').value;
        const queryStr = filterVal === 'all' ? '' : `?location_id=${filterVal}`;
        const res = await fetch(`/api/reports/dashboard${queryStr}`);
        const data = await res.json();
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

        let sales = data.todaySales;
        let orders = data.totalOrders;
        let hourlyData = [12, 19, 35, 28, 42, 15]; // Static base for demo chart

        if (filterVal !== 'all') {
            // Adjust hourly bars slightly based on location just for visual variety if desired, or leave static
            hourlyData = hourlyData.map(v => Math.max(1, Math.floor(v * (orders / 24))));
        }

        document.getElementById('report-sales').textContent = formatter.format(sales);
        document.getElementById('report-orders').textContent = orders;
        document.getElementById('report-customers').textContent = data.activeCustomers;
        document.getElementById('report-top-item').textContent = data.topSelling;

        // --- 1. Main Revenue Line Chart ---
        const salesCtx = document.getElementById('salesChart').getContext('2d');
        if (salesChartInstance) salesChartInstance.destroy();

        // Create a seamless gradient fill
        const gradient = salesCtx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)'); // Indigo border
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        salesChartInstance = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Revenue',
                    data: [1200, 1900, 3000, 4100, 2400, 3100, sales], // Use 'sales' variable here
                    borderColor: '#6366f1', // Indigo
                    backgroundColor: gradient,
                    borderWidth: 4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.4, // Super smooth curves
                    fill: true
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 2000, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Inter', size: 14 },
                        bodyFont: { family: 'Inter', size: 14 },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function (context) { return '$' + context.parsed.y.toLocaleString(); }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)', borderDash: [5, 5] },
                        ticks: { font: { family: 'Inter' }, callback: (value) => '$' + value }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter' } }
                    }
                }
            }
        });

        // --- 2. Category Doughnut Chart ---
        const catCtx = document.getElementById('categoryChart').getContext('2d');
        if (categoryChartInstance) categoryChartInstance.destroy();

        categoryChartInstance = new Chart(catCtx, {
            type: 'doughnut',
            data: {
                labels: ['Electronics', 'Furniture', 'Clothing', 'Accessories'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: [
                        '#6366f1', // Indigo
                        '#10b981', // Emerald
                        '#f59e0b', // Amber
                        '#ec4899'  // Pink
                    ],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Sexy thin rings
                animation: { animateScale: true, animateRotate: true, duration: 2000, easing: 'easeOutBounce' },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { font: { family: 'Inter', size: 13 }, usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        bodyFont: { family: 'Inter' }
                    }
                }
            }
        });

        // --- 3. Peak Hourly Bar Chart ---
        const hourCtx = document.getElementById('hourlyChart').getContext('2d');
        if (hourlyChartInstance) hourlyChartInstance.destroy();

        hourlyChartInstance = new Chart(hourCtx, {
            type: 'bar',
            data: {
                labels: ['9AM', '11AM', '1PM', '3PM', '5PM', '7PM'],
                datasets: [{
                    label: 'Transactions',
                    data: hourlyData,
                    backgroundColor: '#38bdf8', // Light Blue
                    borderRadius: 6, // Rounded bar tops
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1500, easing: 'easeOutElastic' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        bodyFont: { family: 'Inter' }
                    }
                },
                scales: {
                    y: { display: false, beginAtZero: true }, // Hide Y axis entirely for a cleaner look
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    // --- Filter logic ---
    const applyFiltersBtn = document.getElementById('btn-apply-report-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            fetchReports();
        });
    }

    // --- Work Orders Logic ---
    const openAddWoBtn = document.getElementById('open-add-wo');
    const addWoModal = document.getElementById('add-wo-modal');
    const saveWoBtn = document.getElementById('save-wo-btn');

    const addWoJobBtn = document.getElementById('add-wo-job-btn');
    const woJobsContainer = document.getElementById('wo-jobs-container');
    const addWoItemBtn = document.getElementById('add-wo-item-btn');
    const woItemsContainer = document.getElementById('wo-items-container');

    if (openAddWoBtn) {
        openAddWoBtn.addEventListener('click', () => addWoModal.classList.remove('hidden'));
    }

    if (addWoJobBtn) {
        addWoJobBtn.addEventListener('click', () => {
            const el = document.createElement('div');
            el.style = "background:white; padding:15px; border-radius:6px; border:1px solid var(--border-color);";
            el.innerHTML = `
                <div class="form-group mb-3">
                    <label>Job Title</label>
                    <input type="text" class="form-control wo-job-title" placeholder="New Job">
                </div>
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label>Technician</label>
                        <select class="form-control wo-job-tech"><option>Unassigned</option><option>John Doe</option></select>
                    </div>
                    <div class="form-group">
                        <label>Tag/Type</label>
                        <select class="form-control wo-job-tag"><option>Hardware</option><option>Software</option></select>
                    </div>
                </div>
                <button class="btn btn-outline border-rose text-rose remove-job-btn mt-2" style="padding:4px 8px; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> Remove</button>
            `;
            el.querySelector('.remove-job-btn').addEventListener('click', () => el.remove());
            woJobsContainer.appendChild(el);
        });
    }

    if (addWoItemBtn) {
        addWoItemBtn.addEventListener('click', () => {
            const el = document.createElement('div');
            el.style = "display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:10px; align-items:end;";
            el.innerHTML = `
                <div class="form-group"><input type="text" class="form-control wo-item-desc" placeholder="Part Name"></div>
                <div class="form-group"><input type="number" class="form-control wo-item-price" value="0.00" step="0.01"></div>
                <div class="form-group"><select class="form-control wo-item-type"><option>Material</option><option>Service</option></select></div>
                <div class="form-group"><button class="btn btn-outline border-rose text-rose remove-item-btn" style="padding:8px;"><i class="fa-solid fa-trash"></i></button></div>
            `;
            el.querySelector('.remove-item-btn').addEventListener('click', () => el.remove());
            woItemsContainer.appendChild(el);
        });
    }

    if (saveWoBtn) {
        saveWoBtn.addEventListener('click', async () => {
            // Build Base Payload
            const payload = {
                customer_id: document.getElementById('wo-cust-id').value,
                location_id: state.currentLocation.id,
                status: document.getElementById('wo-status').value,
                due_date: document.getElementById('wo-due').value,
                bin_loc: document.getElementById('wo-bin').value,
                loaner_id: document.getElementById('wo-loaner').value,
                desc: document.getElementById('wo-desc').value,
                make: document.getElementById('wo-make').value,
                model: document.getElementById('wo-model').value,
                serial: document.getElementById('wo-serial').value,
                upc: document.getElementById('wo-upc').value,
                accessories: document.getElementById('wo-accessories').value,
                internal_comments: document.getElementById('wo-internal-comments').value,
                receipt_comments: document.getElementById('wo-receipt-comments').value,
                deposit: parseFloat(document.getElementById('wo-deposit').value) || 0,
                jobs: [],
                items: []
            };

            // Gather Jobs
            woJobsContainer.querySelectorAll('div[style*="background:white"]').forEach(el => {
                payload.jobs.push({
                    title: el.querySelector('.wo-job-title').value,
                    technician: el.querySelector('.wo-job-tech').value,
                    tags: el.querySelector('.wo-job-tag').value
                });
            });

            // Gather Items
            woItemsContainer.querySelectorAll('div[style*="display:grid"]').forEach(el => {
                const desc = el.querySelector('.wo-item-desc').value;
                if (!desc) return; // skip empty
                payload.items.push({
                    type: el.querySelector('.wo-item-type').value,
                    description: desc,
                    price: parseFloat(el.querySelector('.wo-item-price').value) || 0,
                    qty: 1
                });
            });

            const res = await fetch('/api/work_orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                addWoModal.classList.add('hidden');
                fetchWorkOrders();
                // We'd reset the form here normally
            } else {
                const errData = await res.json().catch(() => ({}));
                alert("Failed to save Work Order: " + (errData.error || res.statusText));
            }
        });
    }

    async function fetchWorkOrders() {
        const tbody = document.getElementById('work-orders-table-body');
        if (!tbody) return;

        const res = await fetch('/api/work_orders');
        if (!res.ok) return;
        const wos = await res.json();

        tbody.innerHTML = '';
        if (wos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon-wrapper"><i class="fa-solid fa-screwdriver-wrench"></i></div>
                        <p>No Work Orders Found</p>
                        <span class="empty-sub">Create a new work order to begin tracking repairs/customizations.</span>
                    </td>
                </tr>
            `;
            return;
        }

        wos.forEach(wo => {
            const dateStr = wo.received_date ? new Date(wo.received_date).toLocaleDateString() : 'N/A';
            const dueStr = wo.due_date ? new Date(wo.due_date).toLocaleDateString() : 'N/A';

            let statusBadge = 'badge-warning';
            if (wo.status === 'Ready for Pickup') statusBadge = 'badge-success';
            else if (wo.status === 'In Progress') statusBadge = 'badge-blue';

            // Calculate total based on parts... API doesn't return joined totals yet in standard view, using deposit + 50 as a mock for now
            const mockTotal = wo.deposit + 50.00;

            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:#f1f5f9; color:#475569">WO-${wo.id + 1000}</span></td>
                    <td style="font-weight:600;">Customer #${wo.customer_id || 'Walk-in'}</td>
                    <td>${dateStr}</td>
                    <td>${dueStr}</td>
                    <td><span class="badge ${statusBadge}">${wo.status}</span></td>
                    <td>${wo.make || 'Unknown'} ${wo.model || ''}</td>
                    <td style="font-weight:700;">$${mockTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    // Attempt to load WO list if on WO tab
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            if (li.dataset.tab === 'work-orders') {
                fetchWorkOrders();
            }
        });
    });

    // Call INIT
    initApp();
});
