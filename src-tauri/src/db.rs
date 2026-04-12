use rusqlite::{Connection, Result as SqliteResult};
use tauri::{AppHandle, Manager};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> SqliteResult<Self> {
        // 获取应用数据目录
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data dir");

        // 创建目录（如果不存在）
        std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

        let db_path = app_data_dir.join("inventory.db");
        let conn = Connection::open(db_path)?;

        let db = Database { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        // 密码表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY,
                password_hash TEXT NOT NULL UNIQUE
            )",
            [],
        )?;

        // 商品表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                unit TEXT NOT NULL,
                cost_price REAL NOT NULL DEFAULT 0,
                sell_price REAL NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            )",
            [],
        )?;

        // 入库记录
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS inbound_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                supplier TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )",
            [],
        )?;

        // 出库记录
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS outbound_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                customer TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )",
            [],
        )?;

        Ok(())
    }

    pub fn has_password(&self) -> SqliteResult<bool> {
        let mut stmt = self.conn.prepare("SELECT COUNT(*) as count FROM passwords")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn set_password(&self, password_hash: &str) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO passwords (id, password_hash) VALUES (1, ?)",
            [password_hash],
        )?;
        Ok(())
    }

    pub fn get_password_hash(&self) -> SqliteResult<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT password_hash FROM passwords WHERE id = 1")?;
        let result = stmt.query_row([], |row| row.get(0));
        match result {
            Ok(hash) => Ok(Some(hash)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // 商品操作
    pub fn add_product(&self, name: &str, category: &str, unit: &str, cost_price: f64, sell_price: f64, stock: i32) -> SqliteResult<i64> {
        self.conn.execute(
            "INSERT INTO products (name, category, unit, cost_price, sell_price, stock) VALUES (?, ?, ?, ?, ?, ?)",
            [name, category, unit, &cost_price.to_string(), &sell_price.to_string(), &stock.to_string()],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_product(&self, id: i64, name: &str, category: &str, unit: &str, cost_price: f64, sell_price: f64, stock: i32) -> SqliteResult<()> {
        self.conn.execute(
            "UPDATE products SET name = ?, category = ?, unit = ?, cost_price = ?, sell_price = ?, stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [name, category, unit, &cost_price.to_string(), &sell_price.to_string(), &stock.to_string(), &id.to_string()],
        )?;
        Ok(())
    }

    pub fn delete_product(&self, id: i64) -> SqliteResult<()> {
        self.conn.execute("DELETE FROM products WHERE id = ?", [&id.to_string()])?;
        Ok(())
    }

    pub fn get_products(&self) -> SqliteResult<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, category, unit, cost_price, sell_price, stock, created_at, updated_at FROM products ORDER BY id DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "unit": row.get::<_, String>(3)?,
                "cost_price": row.get::<_, f64>(4)?,
                "sell_price": row.get::<_, f64>(5)?,
                "stock": row.get::<_, i32>(6)?,
                "created_at": row.get::<_, String>(7)?,
                "updated_at": row.get::<_, String>(8)?,
            }))
        })?;

        let mut products = Vec::new();
        for row in rows {
            products.push(row?);
        }
        Ok(products)
    }

    // 入库操作
    pub fn add_inbound(&self, product_id: i64, quantity: i32, price: f64, supplier: &str) -> SqliteResult<i64> {
        let total = quantity as f64 * price;

        // 开始事务
        let tx = self.conn.unchecked_transaction()?;

        // 添加入库记录
        tx.execute(
            "INSERT INTO inbound_orders (product_id, quantity, price, total, supplier) VALUES (?, ?, ?, ?, ?)",
            [&product_id.to_string(), &quantity.to_string(), &price.to_string(), &total.to_string(), supplier],
        )?;

        // 更新库存
        tx.execute(
            "UPDATE products SET stock = stock + ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [&quantity.to_string(), &product_id.to_string()],
        )?;

        tx.commit()?;
        Ok(self.conn.last_insert_rowid())
    }

    // 出库操作
    pub fn add_outbound(&self, product_id: i64, quantity: i32, price: f64, customer: &str) -> SqliteResult<i64> {
        let total = quantity as f64 * price;

        // 开始事务
        let tx = self.conn.unchecked_transaction()?;

        // 检查库存
        let current_stock: i32 = tx.query_row(
            "SELECT stock FROM products WHERE id = ?",
            [&product_id.to_string()],
            |row| row.get(0),
        )?;

        if current_stock < quantity {
            return Err(rusqlite::Error::InvalidParameterName("库存不足".to_string()));
        }

        // 添加出库记录
        tx.execute(
            "INSERT INTO outbound_orders (product_id, quantity, price, total, customer) VALUES (?, ?, ?, ?, ?)",
            [&product_id.to_string(), &quantity.to_string(), &price.to_string(), &total.to_string(), customer],
        )?;

        // 更新库存
        tx.execute(
            "UPDATE products SET stock = stock - ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [&quantity.to_string(), &product_id.to_string()],
        )?;

        tx.commit()?;
        Ok(self.conn.last_insert_rowid())
    }

    // 统计数据
    pub fn get_statistics(&self) -> SqliteResult<serde_json::Value> {
        // 商品总数
        let product_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM products",
            [],
            |row| row.get(0),
        )?;

        // 库存总数
        let total_stock: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(stock), 0) FROM products",
            [],
            |row| row.get(0),
        )?;

        // 库存总价值（按成本价）
        let total_value: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(stock * cost_price), 0) FROM products",
            [],
            |row| row.get(0),
        )?;

        // 本月销售额
        let monthly_sales: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM outbound_orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')",
            [],
            |row| row.get(0),
        )?;

        // 本月利润
        let monthly_profit: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(ob.quantity * (ob.price - p.cost_price)), 0)
             FROM outbound_orders ob
             JOIN products p ON ob.product_id = p.id
             WHERE strftime('%Y-%m', ob.created_at) = strftime('%Y-%m', 'now', 'localtime')",
            [],
            |row| row.get(0),
        )?;

        Ok(serde_json::json!({
            "product_count": product_count,
            "total_stock": total_stock,
            "total_value": total_value,
            "monthly_sales": monthly_sales,
            "monthly_profit": monthly_profit,
        }))
    }

    // 获取入库记录
    pub fn get_inbound_records(&self, start_date: Option<&str>, end_date: Option<&str>) -> SqliteResult<Vec<serde_json::Value>> {
        let mut records = Vec::new();

        if let (Some(start), Some(end)) = (start_date, end_date) {
            let end_with_time = format!("{} 23:59:59", end);
            let mut stmt = self.conn.prepare(
                "SELECT i.id, i.product_id, p.name, i.quantity, i.price, i.total, i.supplier, i.created_at 
                 FROM inbound_orders i 
                 JOIN products p ON i.product_id = p.id 
                 WHERE i.created_at BETWEEN ? AND ?
                 ORDER BY i.id DESC"
            )?;
            let rows = stmt.query_map([start, &end_with_time], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "product_id": row.get::<_, i64>(1)?,
                    "product_name": row.get::<_, String>(2)?,
                    "quantity": row.get::<_, i32>(3)?,
                    "price": row.get::<_, f64>(4)?,
                    "total": row.get::<_, f64>(5)?,
                    "supplier": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            })?;
            for row in rows {
                records.push(row?);
            }
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT i.id, i.product_id, p.name, i.quantity, i.price, i.total, i.supplier, i.created_at 
                 FROM inbound_orders i 
                 JOIN products p ON i.product_id = p.id 
                 ORDER BY i.id DESC LIMIT 100"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "product_id": row.get::<_, i64>(1)?,
                    "product_name": row.get::<_, String>(2)?,
                    "quantity": row.get::<_, i32>(3)?,
                    "price": row.get::<_, f64>(4)?,
                    "total": row.get::<_, f64>(5)?,
                    "supplier": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            })?;
            for row in rows {
                records.push(row?);
            }
        }

        Ok(records)
    }

    // 智能补全 - 根据商品名称模糊匹配返回推荐
    pub fn get_product_suggestions(&self, name: &str) -> SqliteResult<Vec<serde_json::Value>> {
        let pattern = format!("%{}%", name);
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT category, unit, cost_price, sell_price 
             FROM products 
             WHERE name LIKE ? AND category IS NOT NULL AND category != ''
             ORDER BY updated_at DESC 
             LIMIT 3"
        )?;
        let rows = stmt.query_map([&pattern], |row| {
            Ok(serde_json::json!({
                "category": row.get::<_, String>(0)?,
                "unit": row.get::<_, String>(1)?,
                "cost_price": row.get::<_, f64>(2)?,
                "sell_price": row.get::<_, f64>(3)?,
            }))
        })?;
        let mut suggestions = Vec::new();
        for row in rows {
            suggestions.push(row?);
        }
        Ok(suggestions)
    }

    // 获取低库存预警商品
    pub fn get_low_stock_products(&self) -> SqliteResult<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, category, unit, cost_price, sell_price, stock 
             FROM products 
             WHERE stock < 10 
             ORDER BY stock ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "unit": row.get::<_, String>(3)?,
                "cost_price": row.get::<_, f64>(4)?,
                "sell_price": row.get::<_, f64>(5)?,
                "stock": row.get::<_, i32>(6)?,
            }))
        })?;

        let mut products = Vec::new();
        for row in rows {
            products.push(row?);
        }
        Ok(products)
    }

    // 获取出库记录
    pub fn get_outbound_records(&self, start_date: Option<&str>, end_date: Option<&str>) -> SqliteResult<Vec<serde_json::Value>> {
        let mut records = Vec::new();

        if let (Some(start), Some(end)) = (start_date, end_date) {
            let end_with_time = format!("{} 23:59:59", end);
            let mut stmt = self.conn.prepare(
                "SELECT o.id, o.product_id, p.name, o.quantity, o.price, o.total, o.customer, o.created_at 
                 FROM outbound_orders o 
                 JOIN products p ON o.product_id = p.id 
                 WHERE o.created_at BETWEEN ? AND ?
                 ORDER BY o.id DESC"
            )?;
            let rows = stmt.query_map([start, &end_with_time], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "product_id": row.get::<_, i64>(1)?,
                    "product_name": row.get::<_, String>(2)?,
                    "quantity": row.get::<_, i32>(3)?,
                    "price": row.get::<_, f64>(4)?,
                    "total": row.get::<_, f64>(5)?,
                    "customer": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            })?;
            for row in rows {
                records.push(row?);
            }
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT o.id, o.product_id, p.name, o.quantity, o.price, o.total, o.customer, o.created_at 
                 FROM outbound_orders o 
                 JOIN products p ON o.product_id = p.id 
                 ORDER BY o.id DESC LIMIT 100"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "product_id": row.get::<_, i64>(1)?,
                    "product_name": row.get::<_, String>(2)?,
                    "quantity": row.get::<_, i32>(3)?,
                    "price": row.get::<_, f64>(4)?,
                    "total": row.get::<_, f64>(5)?,
                    "customer": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            })?;
            for row in rows {
                records.push(row?);
            }
        }

        Ok(records)
    }
}
