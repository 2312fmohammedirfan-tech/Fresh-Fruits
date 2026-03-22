import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

/**
 * FruitDB - IndexedDB Wrapper for Fresh Fruits Store
 */
class FruitDB {
    constructor() {
        this.dbName = 'FreshFruitDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Users Store
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                }
                
                // Products Store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('category', 'category', { unique: false });
                }
                
                // Orders Store
                if (!db.objectStoreNames.contains('orders')) {
                    const orderStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                    orderStore.createIndex('userId', 'userId', { unique: false });
                }

                // Initial Products Seed
                console.log("DB Upgrade: Stores created.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => reject('Database error: ' + event.target.errorCode);
        });
    }

    // Generic CRUD
    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

/**
 * Main Application Controller
 */
class App {
    constructor() {
        this.db = new FruitDB();
        this.user = JSON.parse(localStorage.getItem('fruit_user')) || null;
        this.cart = JSON.parse(localStorage.getItem('fruit_cart')) || [];
        this.currentView = 'home';
        
        this.init();
    }

    async init() {
        await this.db.init();
        await this.seedProducts();
        this.initFirebase();
        this.setupEventListeners();
        this.updateAuthUI();
        this.updateCartUI();
        this.renderProducts();
        this.setupAnimations();
    }

    async initFirebase() {
        try {
            const firebaseApp = initializeApp(firebaseConfig);
            this.messaging = getMessaging(firebaseApp);

            // Request permission and get token
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(this.messaging, { 
                    vapidKey: 'YOUR_VAPID_KEY' 
                });
                if (token) {
                    console.log('FCM Token:', token);
                    // In a real app, you'd send this to your server
                }
            }

            onMessage(this.messaging, (payload) => {
                console.log('Foreground Message received: ', payload);
                this.showToast(payload.notification.title + ': ' + payload.notification.body);
            });
        } catch (error) {
            console.warn('Firebase initialization failed (check config):', error);
        }
    }

    testNotification() {
        if (!("Notification" in window)) {
            this.showToast("This browser does not support notifications.");
            return;
        }

        if (Notification.permission === "granted") {
            const n = new Notification("Fresh Fruits Store", {
                body: "This is a test notification from your Firebase-ready app!",
                icon: "🍎"
            });
            this.showToast("Test notification fired!");
        } else {
            this.showToast("Please grant notification permission first.");
            Notification.requestPermission();
        }
    }

    async seedProducts() {
        if (localStorage.getItem('fruit_seeded_v3')) return;
        const initialFruits = [
            { name: 'Organic Mango', price: 120, stock: 50, category: 'tropical', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&q=80&w=400' },
            { name: 'Crispy Apple', price: 180, stock: 30, category: 'seasonal', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1568702846914-96090560e10e?auto=format&fit=crop&q=80&w=400' },
            { name: 'Fresh Strawberries', price: 250, stock: 20, category: 'berries', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1518118014389-724e03102434?auto=format&fit=crop&q=80&w=400' },
            { name: 'Sweet Banana', price: 60, stock: 100, category: 'tropical', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&q=80&w=400' },
            { name: 'Blueberries', price: 400, stock: 15, category: 'berries', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1425934322444-cbd9b1fa9044?auto=format&fit=crop&q=80&w=400' },
            { name: 'Dragon Fruit', price: 350, stock: 12, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1510442340621-0a6eaefaaab2?auto=format&fit=crop&q=80&w=400' },
            { name: 'Golden Pineapple', price: 90, stock: 40, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1587883012610-e3df17d41270?auto=format&fit=crop&q=80&w=400' },
            { name: 'Red Grapes', price: 220, stock: 25, category: 'seasonal', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1596316279148-3563dc682e8e?auto=format&fit=crop&q=80&w=400' },
            { name: 'Pomegranate', price: 190, stock: 35, category: 'seasonal', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1615486171449-41ec223bfb06?auto=format&fit=crop&q=80&w=400' },
            { name: 'Kiwi Fruit', price: 280, stock: 20, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1560155016146-21dc8f7574ea?auto=format&fit=crop&q=80&w=400' },
            { name: 'Ripe Oranges', price: 110, stock: 60, category: 'seasonal', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1611080663583-20914e6eeb23?auto=format&fit=crop&q=80&w=400' },
            { name: 'Hass Avocados', price: 450, stock: 18, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1604285141012-706f33d7b43a?auto=format&fit=crop&q=80&w=400' },
            { name: 'Sweet Cherries', price: 600, stock: 10, category: 'berries', status: 'Available', unit: 'kg', image: 'https://images.unsplash.com/photo-1568289873099-b1d5bd2dd651?auto=format&fit=crop&q=80&w=400' },
            { name: 'Passion Fruit', price: 320, stock: 15, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1596001007907-735ab0adcd5e?auto=format&fit=crop&q=80&w=400' },
            { name: 'Fresh Watermelon', price: 45, stock: 80, category: 'seasonal', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1589047915570-5b62b14421cc?auto=format&fit=crop&q=80&w=400' },
            { name: 'Papaya', price: 150, stock: 25, category: 'tropical', status: 'Available', unit: 'piece', image: 'https://images.unsplash.com/photo-1517282009859-f000ef1b7829?auto=format&fit=crop&q=80&w=400' }
        ];

        const products = await this.db.getAll('products');
        for (const fruit of initialFruits) {
            const existing = products.find(p => p.name === fruit.name);
            if (!existing) {
                await this.db.add('products', fruit);
            } else if (existing.image !== fruit.image || existing.unit !== fruit.unit) {
                // Update image URL or unit if it differs from the current seed
                existing.image = fruit.image;
                existing.unit = fruit.unit;
                await this.db.update('products', existing);
            }
        }

        // Ensure Admin User exists
        const users = await this.db.getAll('users');
        if (!users.find(u => u.email === 'admin@fruit.com')) {
            await this.db.add('users', { name: 'Admin User', email: 'admin@fruit.com', password: 'admin', role: 'admin', address: 'Admin HQ' });
            console.log("Admin seeded.");
        }
        localStorage.setItem('fruit_seeded_v3', 'true');
    }

    setupAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    setupEventListeners() {
        // Nav Links
        document.querySelectorAll('[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showView(link.dataset.view);
            });
        });

        // Cart Toggle
        const cartToggle = document.getElementById('cart-toggle');
        const cartSidebar = document.getElementById('cart-sidebar');
        const closeCart = document.getElementById('close-cart');

        cartToggle.addEventListener('click', () => cartSidebar.classList.add('active'));
        closeCart.addEventListener('click', () => cartSidebar.classList.remove('active'));

        // Checkout Button
        document.getElementById('checkout-btn').addEventListener('click', () => this.handleCheckout());

        // Auth
        document.getElementById('login-btn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('signup-btn').addEventListener('click', () => this.showAuthModal('signup'));
        document.querySelector('.close-modal').addEventListener('click', () => this.toggleModal('auth-modal', false));
        document.querySelector('.close-modal-product').addEventListener('click', () => this.toggleModal('product-modal-container', false));
        
        document.getElementById('auth-form').addEventListener('submit', (e) => this.handleAuth(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Catalog Search & Filter
        document.getElementById('product-search').addEventListener('input', () => this.renderProducts());
        document.getElementById('category-filter').addEventListener('change', () => this.renderProducts());

        // Admin
        document.getElementById('admin-panel-btn').addEventListener('click', () => this.showView('admin'));
    }

    async handleCheckout() {
        if (!this.user) {
            this.showAuthModal('login');
            this.showToast('Please login to checkout', 'error');
            return;
        }

        if (this.cart.length === 0) {
            this.showToast('Your basket is empty', 'error');
            return;
        }

        // Open Payment Selection Modal
        this.toggleModal('payment-modal-container', true);
    }

    async processPayment(method) {
        this.toggleModal('payment-modal-container', false);
        
        if (method !== 'Cash on Delivery') {
            this.showToast(`Initializing ${method} secure payment...`, 'success');
            // Simulate UPI/Payment Gateway delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.showToast(`${method} Payment Successful! ✅`);
        }
        
        await this.placeOrder(method);
    }

    async placeOrder(paymentMethod) {
        const products = await this.db.getAll('products');
        let total = 0;
        const items = this.cart.map(item => {
            const product = products.find(p => p.id === item.id);
            total += product.price * item.qty;
            return { ...item, name: product.name, price: product.price, unit: product.unit || 'kg' };
        });

        const order = {
            userId: this.user.id,
            userName: this.user.name,
            items: items,
            total: total,
            status: 'Placed',
            timestamp: new Date().toISOString(),
            paymentMethod: paymentMethod // Dynamic from selection
        };

        // Update Stock Logic
        for (const item of this.cart) {
            const product = products.find(p => p.id === item.id);
            product.stock -= item.qty;
            await this.db.update('products', product);
        }

        // Send Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('FreshFruits: Order Placed! 🎉', {
                body: `Your order #${order.id || Date.now()} for ${order.paymentMethod} has been received.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143627.png'
            });
        }

        this.cart = [];
        localStorage.removeItem('fruit_cart');
        this.updateCartUI();
        document.getElementById('cart-sidebar').classList.remove('active');
        this.showToast('Order placed successfully! 🎉');
        this.renderProducts();
        if (this.currentView === 'admin') this.renderAdminDashboard();
    }

    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        const target = document.getElementById(`${viewId}-view`);
        if (target) {
            target.classList.remove('hidden');
            this.currentView = viewId;
        }

        if (viewId === 'admin') this.renderAdminDashboard();
        if (viewId === 'profile') {
            this.renderUserOrders();
            this.renderProfileSettings();
        }

        // Update menu active state
        document.querySelectorAll('[data-view]').forEach(l => {
            l.style.color = l.dataset.view === viewId ? 'var(--primary)' : 'var(--text-gray)';
        });
    }

    async renderAdminDashboard() {
        const orders = await this.db.getAll('orders');
        const products = await this.db.getAll('products');
        const container = document.getElementById('admin-view');

        const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
        const totalOrders = orders.length;

        container.innerHTML = `
            <div class="container admin-dashboard">
                <div class="kpi-grid">
                    <div class="kpi-card"><h3>₹${totalRevenue.toFixed(2)}</h3><p>Total Revenue</p></div>
                    <div class="kpi-card"><h3>${totalOrders}</h3><p>Total Orders</p></div>
                    <div class="kpi-card"><h3>${products.length}</h3><p>Active Products</p></div>
                </div>

                <div class="admin-sections">
                    <div class="admin-section">
                        <div class="section-header">
                            <h3>Product Management</h3>
                            <div class="header-actions" style="display:flex; gap:0.5rem;">
                                <button class="btn-sm" onclick="app.testNotification()">🔔 Test Notification</button>
                                <button class="btn-primary btn-sm" onclick="app.showAddProductModal()">+ Add Product</button>
                            </div>
                        </div>
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Image</th>
                                    <th>Name</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(p => `
                                    <tr>
                                        <td><img src="${p.image}" class="table-img"></td>
                                        <td>${p.name}</td>
                                        <td>₹${p.price} / ${p.unit || 'kg'}</td>
                                        <td>${p.stock} ${p.unit || 'kg'}</td>
                                        <td>
                                            <button class="btn-icon btn-sm" onclick="app.showEditProductModal(${p.id})">✏️</button>
                                            <button class="btn-icon btn-sm" onclick="app.deleteProduct(${p.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="admin-section">
                        <h3>Order Management</h3>
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Customer</th>
                                    <th>Total</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orders.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(o => `
                                    <tr>
                                        <td>#${o.id}</td>
                                        <td>${o.userName}</td>
                                        <td>₹${o.total.toFixed(2)}</td>
                                        <td><small style="color:var(--text-gray);">${o.paymentMethod || 'COD'}</small></td>
                                        <td><span class="status-badge ${o.status.toLowerCase()}">${o.status}</span></td>
                                        <td>
                                            ${o.status === 'Placed' ? `<button class="btn-sm" onclick="app.updateOrderStatus(${o.id}, 'Delivered')">Deliver</button>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    showAddProductModal() {
        document.getElementById('product-form').reset();
        document.getElementById('p-id').value = '';
        document.getElementById('product-modal-title').textContent = 'Add New Fruit';
        document.getElementById('product-submit-btn').textContent = 'Add Fruit';
        document.getElementById('p-image').required = true;
        this.toggleModal('product-modal-container', true);
    }

    async showEditProductModal(id) {
        const product = await this.db.getById('products', Number(id));
        if (!product) return;

        document.getElementById('p-id').value = product.id;
        document.getElementById('p-name').value = product.name;
        document.getElementById('p-price').value = product.price;
        document.getElementById('p-unit').value = product.unit || 'kg';
        document.getElementById('p-stock').value = product.stock;
        document.getElementById('p-category').value = product.category;
        
        // Image is optional when editing
        document.getElementById('p-image').required = false;
        
        document.getElementById('product-modal-title').textContent = 'Update Fruit';
        document.getElementById('product-submit-btn').textContent = 'Save Changes';
        
        this.toggleModal('product-modal-container', true);
    }

    async handleAddProduct(e) {
        e.preventDefault();
        
        const productId = document.getElementById('p-id').value;
        const fileInput = document.getElementById('p-image');
        const file = fileInput.files[0];

        const saveProduct = async (imageData = null) => {
            const product = {
                name: document.getElementById('p-name').value,
                price: parseFloat(document.getElementById('p-price').value),
                unit: document.getElementById('p-unit').value,
                stock: parseFloat(document.getElementById('p-stock').value),
                category: document.getElementById('p-category').value,
                status: 'Available'
            };

            if (imageData) product.image = imageData;

            if (productId) {
                // Update Existing
                const existing = await this.db.getById('products', Number(productId));
                const updatedProduct = { ...existing, ...product };
                await this.db.update('products', updatedProduct);
                this.showToast('Product updated successfully! ✨');
            } else {
                // Add New
                if (!imageData) {
                    this.showToast('Please select a fruit image.', 'error');
                    return;
                }
                await this.db.add('products', product);
                this.showToast('Product added successfully!');
            }

            this.toggleModal('product-modal-container', false);
            this.renderAdminDashboard();
            this.renderProducts();
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => saveProduct(event.target.result);
            reader.readAsDataURL(file);
        } else {
            saveProduct(); // Update without changing image
        }
    }

    async deleteProduct(id) {
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                await this.db.delete('products', Number(id));
                this.renderAdminDashboard();
                this.renderProducts();
                this.showToast('Product removed');
            } catch (error) {
                console.error("Delete failed:", error);
                this.showToast('Failed to remove product', 'error');
            }
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        const order = await this.db.getById('orders', orderId);
        if (order) {
            order.status = newStatus;
            await this.db.update('orders', order);
            this.renderAdminDashboard();
            this.showToast(`Order #${orderId} marked as ${newStatus}`);

            // Send Notification
            if (newStatus === 'Delivered' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('FreshFruits: Order Delivered! 🚚', {
                    body: `Order #${orderId} has been successfully delivered. Enjoy your fresh fruits!`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143627.png'
                });
            }
        }
    }

    // --- UI Updates ---
    updateAuthUI() {
        const authLinks = document.getElementById('auth-links');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');

        if (this.user) {
            authLinks.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userName.textContent = `Hi, ${this.user.name.split(' ')[0]}`;
            if (this.user.role === 'admin') {
                document.getElementById('admin-panel-btn').classList.remove('hidden');
            }
        } else {
            authLinks.classList.remove('hidden');
            userProfile.classList.add('hidden');
        }
    }

    updateCartUI() {
        const count = this.cart.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('cart-count').textContent = count;
        this.renderCartItems();
    }

    // --- Template Rendering ---
    async renderProducts() {
        let products = await this.db.getAll('products');
        
        // Apply Filters
        const searchInput = document.getElementById('product-search');
        const categoryFilter = document.getElementById('category-filter');
        
        if (searchInput && categoryFilter && this.currentView === 'products') {
            const searchTerm = searchInput.value.toLowerCase();
            const category = categoryFilter.value;

            products = products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.description?.toLowerCase().includes(searchTerm);
                const matchesCategory = category === 'all' || p.category === category;
                return matchesSearch && matchesCategory;
            });
        }

        const featuredGrid = document.getElementById('featured-grid');
        const mainGrid = document.getElementById('main-product-grid');

        // Featured Grid always shows top 4 available products (unfiltered)
        if (featuredGrid) {
            const featuredProducts = (await this.db.getAll('products')).slice(0, 4);
            featuredGrid.innerHTML = featuredProducts.map(p => this.createProductCardHTML(p)).join('');
        }

        // Main Grid gets the filtered products
        if (mainGrid && this.currentView === 'products') {
            if (products.length === 0) {
                mainGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-gray);">No fruits found matching your criteria.</div>';
            } else {
                mainGrid.innerHTML = products.map(p => this.createProductCardHTML(p)).join('');
            }
        }
    }

    createProductCardHTML(p) {
        return `
            <div class="product-card">
                <img src="${p.image}" alt="${p.name}" class="product-image">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <p class="product-price">₹${p.price} / ${p.unit || 'kg'}</p>
                    <p class="product-stock ${p.stock < 10 ? 'low-stock' : ''}">${p.stock} ${p.unit || 'kg'} available</p>
                    <button class="btn-primary" onclick="app.addToCart(${p.id})">Add to Cart</button>
                </div>
            </div>
        `;
    }

    async renderCartItems() {
        const container = document.getElementById('cart-items');
        const products = await this.db.getAll('products');
        
        if (this.cart.length === 0) {
            container.innerHTML = '<p class="empty-msg">Your basket is empty</p>';
            document.getElementById('cart-total').textContent = '₹0.00';
            return;
        }

        let total = 0;
        container.innerHTML = this.cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product) return '';
            const subtotal = product.price * item.qty;
            total += subtotal;

            return `
                <div class="cart-item">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="cart-item-info">
                        <h4>${product.name}</h4>
                        <p>₹${product.price} / ${product.unit || 'kg'}</p>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="app.updateCartQty(${item.id}, -1)">-</button>
                            <span>${item.qty} ${product.unit || 'kg'}</span>
                            <button class="qty-btn" onclick="app.updateCartQty(${item.id}, 1)">+</button>
                        </div>
                    </div>
                    <div class="cart-item-price">₹${subtotal}</div>
                </div>
            `;
        }).join('');

        document.getElementById('cart-total').textContent = `₹${total.toFixed(2)}`;
    }

    async renderUserOrders() {
        if (!this.user) return;
        
        const container = document.getElementById('user-orders-list');
        const allOrders = await this.db.getAll('orders');
        const myOrders = allOrders.filter(o => o.userId === this.user.id).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (myOrders.length === 0) {
            container.innerHTML = '<div class="empty-msg" style="text-align: center; padding: 2rem; color: var(--text-gray);">You have not placed any orders yet.</div>';
            return;
        }

        container.innerHTML = myOrders.map(o => `
            <div class="admin-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h4 style="margin-bottom: 0.2rem;">Order #${o.id}</h4>
                        <small style="color: var(--text-gray);">${new Date(o.timestamp).toLocaleString()}</small>
                    </div>
                    <div>
                        <span class="status-badge ${o.status.toLowerCase()}">${o.status}</span>
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    ${o.items.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed var(--glass-border);">
                            <span>${item.qty} ${item.unit || 'kg'} x ${item.name}</span>
                            <span>₹${(item.price * item.qty).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                    <span>Payment: <span style="color:var(--text-gray); font-weight: normal;">${o.paymentMethod || 'COD'}</span></span>
                    <span>Total: ₹${o.total.toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    }

    async updateCartQty(productId, delta) {
        const itemIndex = this.cart.findIndex(i => i.id === productId);
        if (itemIndex > -1) {
            this.cart[itemIndex].qty += delta;
            if (this.cart[itemIndex].qty <= 0) {
                this.cart.splice(itemIndex, 1);
            }
        }
        localStorage.setItem('fruit_cart', JSON.stringify(this.cart));
        this.updateCartUI();
    }

    // --- Handlers ---
    showAuthModal(type) {
        const title = document.getElementById('modal-title');
        const submitBtn = document.getElementById('auth-submit');
        const nameGroup = document.getElementById('name-group');

        if (type === 'login') {
            title.textContent = 'Welcome Back';
            submitBtn.textContent = 'Login';
            nameGroup.classList.add('hidden');
        } else {
            title.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            nameGroup.classList.remove('hidden');
        }
        this.toggleModal('auth-modal', true);
    }

    toggleModal(id, show) {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById(id);
        if (show) {
            overlay.classList.remove('hidden');
            modal.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
            modal.classList.add('hidden');
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('reg-name').value;
        const isLogin = document.getElementById('auth-submit').textContent === 'Login';

        if (isLogin) {
            const users = await this.db.getAll('users');
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                this.user = user;
                localStorage.setItem('fruit_user', JSON.stringify(user));
            this.toggleModal('auth-modal', false);
            this.updateAuthUI();
            this.showToast('Login successful!');
            this.requestNotificationPermission();
        } else {
            this.showToast('Invalid credentials', 'error');
        }
    } else {
        const newUser = { name, email, password, role: 'customer', address: '' };
        const id = await this.db.add('users', newUser);
        this.user = { ...newUser, id };
        localStorage.setItem('fruit_user', JSON.stringify(this.user));
        this.toggleModal('auth-modal', false);
        this.updateAuthUI();
        this.showToast('Account created!');
        this.requestNotificationPermission();
    }
}

requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted.');
            }
        });
    }
}

handleLogout() {
        this.user = null;
        localStorage.removeItem('fruit_user');
        this.updateAuthUI();
        this.showToast('Logged out');
    }

    async addToCart(productId) {
        const item = this.cart.find(i => i.id === productId);
        if (item) {
            item.qty++;
        } else {
            this.cart.push({ id: productId, qty: 1 });
        }
        localStorage.setItem('fruit_cart', JSON.stringify(this.cart));
        this.updateCartUI();
        this.showToast('Added to basket');
    }

    handleContactForm(e) {
        e.preventDefault();
        const name = document.getElementById('contact-name').value;
        this.showToast(`Thanks ${name}! We'll get back to you soon. 🍊`);
        e.target.reset();
    }

    switchProfileTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        document.getElementById(`${tabName}-tab-content`).classList.remove('hidden');
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabName));
        if (activeBtn) activeBtn.classList.add('active');
    }

    async renderProfileSettings() {
        if (!this.user) return;
        document.getElementById('prof-name').value = this.user.name;
        document.getElementById('prof-email').value = this.user.email;
        document.getElementById('prof-address').value = this.user.address || '';
        document.getElementById('prof-password').value = '';
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        if (!this.user) return;

        const updatedData = {
            ...this.user,
            name: document.getElementById('prof-name').value,
            email: document.getElementById('prof-email').value,
            address: document.getElementById('prof-address').value
        };

        const newPass = document.getElementById('prof-password').value;
        if (newPass) updatedData.password = newPass;

        try {
            await this.db.update('users', updatedData);
            this.user = updatedData;
            localStorage.setItem('fruit_user', JSON.stringify(this.user));
            this.updateAuthUI();
            this.showToast('Profile updated successfully! ✨');
        } catch (error) {
            console.error("Update failed:", error);
            this.showToast('Failed to update profile', 'error');
        }
    }

    showToast(msg, type = 'success') {
        const toast = document.getElementById('notification-toast');
        toast.textContent = msg;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Global instance for inline onclick handlers
window.app = new App();
