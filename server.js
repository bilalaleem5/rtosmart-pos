const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// --- API Endpoints ---

// 1. Locations
app.get('/api/locations', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM locations");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/locations', async (req, res) => {
    try {
        const { name, address } = req.body;
        const { rows } = await pool.query("INSERT INTO locations (name, address) VALUES ($1, $2) RETURNING id", [name, address]);
        res.json({ id: rows[0].id, name, address });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Products
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM products");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/location/:locationId', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM products WHERE location_id = $1", [req.params.locationId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    const {
        sku, name, price, category, stock, location_id, icon,
        unit_type, show_web_price, show_add_to_cart, unlimited_web, track_serial,
        manufacturer, make, model, year, upc, mrf_id, alternate_lookups,
        reorder_point, desired_stock, default_cost, sale_price,
        weight, height, width, length, short_desc, long_desc,
        tax_code, cost_depreciation, is_digital, is_kit, commissionable
    } = req.body;

    const finalIcon = icon || "fa-box";

    const query = `INSERT INTO products (
        sku, name, price, category, icon, stock, location_id,
        unit_type, show_web_price, show_add_to_cart, unlimited_web, track_serial,
        manufacturer, make, model, year, upc, mrf_id, alternate_lookups,
        reorder_point, desired_stock, default_cost, sale_price,
        weight, height, width, length, short_desc, long_desc,
        tax_code, cost_depreciation, is_digital, is_kit, commissionable
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34
    ) RETURNING id`;

    const params = [
        sku, name, price, category, finalIcon, stock, location_id,
        unit_type, show_web_price !== false ? 1 : 0, show_add_to_cart !== false ? 1 : 0, unlimited_web ? 1 : 0, track_serial ? 1 : 0,
        manufacturer, make, model, year, upc, mrf_id, alternate_lookups,
        reorder_point || 0, desired_stock || 0, default_cost || 0, sale_price,
        weight, height, width, length, short_desc, long_desc,
        tax_code, cost_depreciation, is_digital ? 1 : 0, is_kit ? 1 : 0, commissionable !== false ? 1 : 0
    ];

    try {
        const { rows } = await pool.query(query, params);
        res.json({ id: rows[0].id, sku, name, price, category });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    const {
        sku, name, price, category, stock, location_id, icon,
        unit_type, show_web_price, show_add_to_cart, unlimited_web, track_serial,
        manufacturer, make, model, year, upc, mrf_id, alternate_lookups,
        reorder_point, desired_stock, default_cost, sale_price,
        weight, height, width, length, short_desc, long_desc,
        tax_code, cost_depreciation, is_digital, is_kit, commissionable
    } = req.body;

    const query = `UPDATE products SET 
        sku=$1, name=$2, price=$3, category=$4, icon=$5, stock=$6, location_id=$7,
        unit_type=$8, show_web_price=$9, show_add_to_cart=$10, unlimited_web=$11, track_serial=$12,
        manufacturer=$13, make=$14, model=$15, year=$16, upc=$17, mrf_id=$18, alternate_lookups=$19,
        reorder_point=$20, desired_stock=$21, default_cost=$22, sale_price=$23,
        weight=$24, height=$25, width=$26, length=$27, short_desc=$28, long_desc=$29,
        tax_code=$30, cost_depreciation=$31, is_digital=$32, is_kit=$33, commissionable=$34
        WHERE id = $35`;

    const params = [
        sku, name, price, category, icon, stock, location_id,
        unit_type, show_web_price ? 1 : 0, show_add_to_cart ? 1 : 0, unlimited_web ? 1 : 0, track_serial ? 1 : 0,
        manufacturer, make, model, year, upc, mrf_id, alternate_lookups,
        reorder_point, desired_stock, default_cost, sale_price,
        weight, height, width, length, short_desc, long_desc,
        tax_code, cost_depreciation, is_digital ? 1 : 0, is_kit ? 1 : 0, commissionable ? 1 : 0,
        req.params.id
    ];

    try {
        await pool.query(query, params);
        res.json({ message: "Product fully updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Orders
app.post('/api/orders', async (req, res) => {
    const { location_id, customer_id, subtotal, tax, total, status, items } = req.body;
    const date = new Date().toISOString();

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const orderRes = await client.query(
            `INSERT INTO orders (location_id, customer_id, date, subtotal, tax, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [location_id, customer_id || null, date, subtotal, tax, total, status]
        );
        const orderId = orderRes.rows[0].id;

        for (const item of items) {
            await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)", [orderId, item.id, item.qty, item.price]);
            await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.qty, item.id]);
        }

        if (customer_id) {
            await client.query(`UPDATE customers SET total_spent = total_spent + $1 WHERE id = $2`, [total, customer_id]);
        }

        await client.query("COMMIT");
        res.json({ id: orderId, message: "Order processed successfully" });
    } catch (e) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM orders ORDER BY date DESC");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Customers
app.get('/api/customers', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM customers");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customers', async (req, res) => {
    try {
        const {
            name, email, phone, group_type, wants_news, other_phone, phone_ext,
            company, driver_license, street, address2, city, state, zip, country,
            birthday, language, gender, till_alert, anniversary, primary_location
        } = req.body;

        const { rows: existing } = await pool.query("SELECT id FROM customers WHERE phone = $1 OR email = $2", [phone, email]);

        if (existing.length > 0 && (phone || email)) {
            res.json({ id: existing[0].id, message: "Customer already exists" });
        } else {
            const finalGroup = group_type || "Walk-in";
            const query = `INSERT INTO customers (
                name, email, phone, group_type, total_spent,
                wants_news, other_phone, phone_ext, company, driver_license,
                street, address2, city, state, zip, country,
                birthday, language, gender, till_alert, anniversary, primary_location
            ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING id`;

            const params = [
                name, email, phone, finalGroup,
                wants_news ? 1 : 0, other_phone, phone_ext, company, driver_license,
                street, address2, city, state, zip, country || 'United States',
                birthday, language, gender, till_alert, anniversary, primary_location
            ];

            const { rows } = await pool.query(query, params);
            res.json({ id: rows[0].id, name, email, phone, group_type: finalGroup });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Vendors & Purchasing
app.get('/api/vendors', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM vendors");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vendors', async (req, res) => {
    try {
        const { name, contact_info, address, notes } = req.body;
        const { rows } = await pool.query(
            "INSERT INTO vendors (name, contact_info, address, notes) VALUES ($1, $2, $3, $4) RETURNING id",
            [name, contact_info, address, notes]
        );
        res.json({ id: rows[0].id, name, contact_info, address, notes });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/purchasing', async (req, res) => {
    try {
        const query = `
            SELECT po.*, v.name as vendor_name 
            FROM purchase_orders po 
            JOIN vendors v ON po.vendor_id = v.id 
            ORDER BY date DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/purchasing', async (req, res) => {
    try {
        const {
            vendor_id, expected_delivery, tracking_number, ship_date, dont_ship_after,
            freight, discount, notes, total
        } = req.body;
        const date = new Date().toISOString();

        const query = `INSERT INTO purchase_orders (
            vendor_id, date, expected_delivery, tracking_number,
            ship_date, dont_ship_after, freight, discount, notes, total, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending') RETURNING id`;

        const params = [
            vendor_id, date, expected_delivery, tracking_number,
            ship_date, dont_ship_after, freight || 0, discount || 0, notes, total
        ];

        const { rows } = await pool.query(query, params);
        res.json({ id: rows[0].id, vendor_id, status: 'Pending' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/purchasing/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query("UPDATE purchase_orders SET status = $1 WHERE id = $2", [status, req.params.id]);
        res.json({ message: "Status updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Receiving Orders
app.post('/api/receiving', async (req, res) => {
    try {
        const { po_id, vendor_id, location_id, invoice_number, notes, subtotal, freight, discount, total } = req.body;
        const date = new Date().toISOString();

        const { rows } = await pool.query(
            `INSERT INTO receiving_orders (po_id, vendor_id, location_id, date, invoice_number, notes, subtotal, freight, discount, total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [po_id || null, vendor_id, location_id, date, invoice_number, notes, subtotal, freight, discount, total]
        );
        res.json({ id: rows[0].id, status: 'Received' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Work Orders
app.post('/api/work_orders', async (req, res) => {
    const {
        customer_id, location_id, due_date, bin_location, loaner, tax_profile,
        declared_value, item_desc, department, upc, sku, make, model, serial_number,
        accessories, internal_comments, receipt_comments, deposit,
        jobs, items
    } = req.body;

    const received_date = new Date().toISOString();

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const query = `INSERT INTO work_orders (
            customer_id, location_id, received_date, due_date, bin_location, loaner, tax_profile,
            declared_value, item_desc, department, upc, sku, make, model, serial_number,
            accessories, internal_comments, receipt_comments, deposit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id`;

        const params = [
            customer_id, location_id, received_date, due_date, bin_location, loaner, tax_profile,
            declared_value, item_desc, department, upc, sku, make, model, serial_number,
            accessories, internal_comments, receipt_comments, deposit || 0
        ];

        const woRes = await client.query(query, params);
        const woId = woRes.rows[0].id;

        if (jobs && jobs.length > 0) {
            for (const job of jobs) {
                await client.query("INSERT INTO work_order_jobs (work_order_id, title, summary, technician, tag) VALUES ($1, $2, $3, $4, $5)",
                    [woId, job.title, job.summary, job.technician, job.tag]);
            }
        }

        if (items && items.length > 0) {
            for (const item of items) {
                await client.query("INSERT INTO work_order_items (work_order_id, type, description, price, quantity) VALUES ($1, $2, $3, $4, $5)",
                    [woId, item.type, item.description, item.price, item.quantity]);
            }
        }

        await client.query("COMMIT");
        res.json({ id: woId, message: "Work order created successfully" });
    } catch (e) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.get('/api/work_orders', async (req, res) => {
    try {
        const query = `
            SELECT wo.*, c.name as customer_name 
            FROM work_orders wo
            LEFT JOIN customers c ON wo.customer_id = c.id
            ORDER BY received_date DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Reports / Dashboard
app.get('/api/reports/dashboard', async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dateStr = todayStart.toISOString();

        const locId = req.query.location_id;

        let metrics = {
            todaySales: 0,
            totalOrders: 0,
            activeCustomers: 0,
            topSelling: "--"
        };

        let salesQuery = "SELECT SUM(total) as sales FROM orders WHERE date >= $1";
        let salesParams = [dateStr];
        let ordersQuery = "SELECT COUNT(id) as cnt FROM orders WHERE 1=1";
        let ordersParams = [];

        if (locId) {
            salesQuery += " AND location_id = $2";
            salesParams.push(locId);
            ordersQuery += " AND location_id = $1";
            ordersParams.push(locId);
        }

        const salesRes = await pool.query(salesQuery, salesParams);
        if (salesRes.rows[0] && salesRes.rows[0].sales) metrics.todaySales = salesRes.rows[0].sales;

        const ordersRes = await pool.query(ordersQuery, ordersParams);
        if (ordersRes.rows[0] && ordersRes.rows[0].cnt) metrics.totalOrders = parseInt(ordersRes.rows[0].cnt, 10);

        const custRes = await pool.query("SELECT COUNT(id) as cnt FROM customers");
        if (custRes.rows[0] && custRes.rows[0].cnt) metrics.activeCustomers = parseInt(custRes.rows[0].cnt, 10);

        const topRes = await pool.query(`
            SELECT p.name, SUM(oi.quantity) as sold 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            GROUP BY p.id 
            ORDER BY sold DESC 
            LIMIT 1
        `);
        if (topRes.rows[0] && topRes.rows[0].name) metrics.topSelling = topRes.rows[0].name;

        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback to index.html for SPA feel
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`RTOSmart POS Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
