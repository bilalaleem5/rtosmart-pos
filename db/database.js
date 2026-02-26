require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL // Vercel injects this
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function initDb() {
    try {
        console.log("Connected to Vercel Postgres Database.");

        // 1. Locations
        await pool.query(`CREATE TABLE IF NOT EXISTS locations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT
        )`);

        // 2. Products
        await pool.query(`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            sku TEXT UNIQUE,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            icon TEXT,
            stock INTEGER DEFAULT 0,
            location_id INTEGER REFERENCES locations(id),
            unit_type TEXT,
            show_web_price INTEGER DEFAULT 1,
            show_add_to_cart INTEGER DEFAULT 1,
            unlimited_web INTEGER DEFAULT 0,
            track_serial INTEGER DEFAULT 0,
            manufacturer TEXT,
            make TEXT,
            model TEXT,
            year TEXT,
            upc TEXT,
            mrf_id TEXT,
            alternate_lookups TEXT,
            reorder_point INTEGER DEFAULT 0,
            desired_stock INTEGER DEFAULT 0,
            default_cost REAL DEFAULT 0,
            sale_price REAL,
            weight REAL,
            height REAL,
            width REAL,
            length REAL,
            short_desc TEXT,
            long_desc TEXT,
            tax_code TEXT,
            cost_depreciation TEXT,
            is_digital INTEGER DEFAULT 0,
            is_kit INTEGER DEFAULT 0,
            commissionable INTEGER DEFAULT 1
        )`);

        // 3. Customers
        await pool.query(`CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            group_type TEXT,
            total_spent REAL DEFAULT 0,
            wants_news INTEGER DEFAULT 0,
            other_phone TEXT,
            phone_ext TEXT,
            company TEXT,
            driver_license TEXT,
            street TEXT,
            address2 TEXT,
            city TEXT,
            state TEXT,
            zip TEXT,
            country TEXT DEFAULT 'United States',
            birthday TEXT,
            language TEXT,
            gender TEXT,
            till_alert TEXT,
            anniversary TEXT,
            primary_location INTEGER
        )`);

        // 4. Orders
        await pool.query(`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            location_id INTEGER REFERENCES locations(id),
            customer_id INTEGER REFERENCES customers(id),
            date TEXT,
            subtotal REAL,
            tax REAL,
            total REAL,
            status TEXT
        )`);

        // 5. Order Items
        await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
            order_id INTEGER REFERENCES orders(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER,
            price REAL
        )`);

        // 6. Vendors
        await pool.query(`CREATE TABLE IF NOT EXISTS vendors (
            id SERIAL PRIMARY KEY,
            name TEXT,
            contact_info TEXT,
            address TEXT,
            notes TEXT
        )`);

        // 7. Purchase Orders
        await pool.query(`CREATE TABLE IF NOT EXISTS purchase_orders (
            id SERIAL PRIMARY KEY,
            vendor_id INTEGER REFERENCES vendors(id),
            date TEXT,
            expected_delivery TEXT,
            tracking_number TEXT,
            ship_date TEXT,
            dont_ship_after TEXT,
            freight REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            notes TEXT,
            subtotal REAL DEFAULT 0,
            total REAL,
            status TEXT
        )`);

        // 8. Receiving Orders
        await pool.query(`CREATE TABLE IF NOT EXISTS receiving_orders (
            id SERIAL PRIMARY KEY,
            po_id INTEGER REFERENCES purchase_orders(id),
            vendor_id INTEGER REFERENCES vendors(id),
            location_id INTEGER,
            date TEXT,
            invoice_number TEXT,
            notes TEXT,
            subtotal REAL,
            freight REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL
        )`);

        // 9. Work Orders
        await pool.query(`CREATE TABLE IF NOT EXISTS work_orders (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            location_id INTEGER REFERENCES locations(id),
            status TEXT DEFAULT 'New',
            received_date TEXT,
            due_date TEXT,
            bin_location TEXT,
            loaner TEXT,
            tax_profile TEXT,
            declared_value REAL,
            item_desc TEXT,
            department TEXT,
            upc TEXT,
            sku TEXT,
            make TEXT,
            model TEXT,
            serial_number TEXT,
            accessories TEXT,
            internal_comments TEXT,
            receipt_comments TEXT,
            deposit REAL DEFAULT 0
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS work_order_jobs (
            id SERIAL PRIMARY KEY,
            work_order_id INTEGER REFERENCES work_orders(id),
            title TEXT,
            summary TEXT,
            technician TEXT,
            tag TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS work_order_items (
            id SERIAL PRIMARY KEY,
            work_order_id INTEGER REFERENCES work_orders(id),
            job_id INTEGER REFERENCES work_order_jobs(id),
            type TEXT, 
            description TEXT,
            price REAL,
            quantity INTEGER
        )`);

        await seedData();
    } catch (e) {
        console.error("Failed to init Postgres schema:", e);
    }
}

async function seedData() {
    try {
        const res = await pool.query("SELECT COUNT(*) as count FROM locations");
        // Postgres returns count as a string
        if (parseInt(res.rows[0].count, 10) === 0) {
            console.log("Seeding Postgres database with initial data...");

            await pool.query("INSERT INTO locations (name, address) VALUES ('Main Store', '123 Smart Ave, NY')");
            await pool.query("INSERT INTO locations (name, address) VALUES ('Warehouse 2', '456 Industrial Pkwy, NJ')");

            const products = [
                { sku: "AU-928", name: "Premium Wireless Headphones", price: 299.99, category: "Electronics", icon: "fa-headphones", stock: 15, loc: 1 },
                { sku: "FN-104", name: "Ergonomic Office Chair", price: 199.50, category: "Furniture", icon: "fa-chair", stock: 8, loc: 1 },
                { sku: "AC-044", name: "Mechanical Keyboard RGB", price: 129.99, category: "Accessories", icon: "fa-keyboard", stock: 24, loc: 1 },
                { sku: "BD-002", name: "RTO Mattress (Queen Size)", price: 650.00, category: "Furniture", icon: "fa-bed", stock: 5, loc: 1 },
                { sku: "EL-555", name: "Smart Watch Pro Series X", price: 349.00, category: "Electronics", icon: "fa-clock", stock: 12, loc: 1 },
                { sku: "AU-112", name: "Bluetooth Speaker 360", price: 89.99, category: "Electronics", icon: "fa-speaker-deck", stock: 40, loc: 1 },
                { sku: "AC-089", name: "Gaming Mouse Precision", price: 59.99, category: "Accessories", icon: "fa-computer-mouse", stock: 35, loc: 1 },
                { sku: "FN-022", name: "Dual Monitor Desk Mount", price: 45.00, category: "Accessories", icon: "fa-desktop", stock: 18, loc: 1 },
                { sku: "WH-100", name: "Bulk HDMI Cables (50pk)", price: 150.00, category: "Accessories", icon: "fa-plug", stock: 10, loc: 2 }
            ];

            const pQuery = "INSERT INTO products (sku, name, price, category, icon, stock, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7)";
            for (let p of products) {
                await pool.query(pQuery, [p.sku, p.name, p.price, p.category, p.icon, p.stock, p.loc]);
            }

            const customers = [
                { name: "John Doe", email: "john@example.com", phone: "555-0100", group: "Retail", spent: 450.00 },
                { name: "Jane Smith", email: "jane@corp.com", phone: "555-0101", group: "Wholesale", spent: 2400.50 },
                { name: "Bob Wilson", email: "bob@test.com", phone: "555-0102", group: "VIP", spent: 1250.75 }
            ];
            const cQuery = "INSERT INTO customers (name, email, phone, group_type, total_spent) VALUES ($1, $2, $3, $4, $5)";
            for (let c of customers) {
                await pool.query(cQuery, [c.name, c.email, c.phone, c.group, c.spent]);
            }

            const vendors = [
                { name: "TechGadgets Distro", contact: "sales@techgadgets.com" },
                { name: "Furniture Wholesale LLC", contact: "1-800-FURNITURE" }
            ];
            const vQuery = "INSERT INTO vendors (name, contact_info) VALUES ($1, $2)";
            for (let v of vendors) {
                await pool.query(vQuery, [v.name, v.contact]);
            }

            await pool.query("INSERT INTO purchase_orders (vendor_id, date, total, status) VALUES (1, '2026-02-15T10:00:00.000Z', 1500.00, 'Received')");
            await pool.query("INSERT INTO purchase_orders (vendor_id, date, total, status) VALUES (2, '2026-02-25T14:30:00.000Z', 3200.00, 'Pending')");
        }
    } catch (e) {
        console.error("Failed seeding:", e);
    }
}

// Automatically create tables on start when locally running. Vercel function will also run this if we call it.
initDb();

module.exports = pool;
