use crate::error::AppError;
use rusqlite::{params, Connection};
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Result<Self, AppError> {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| AppError::new("PATH_ERROR", e.to_string()))?;

        std::fs::create_dir_all(&app_data_dir)?;

        let db_path = app_data_dir.join("inventory.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.busy_timeout(Duration::from_secs(5))?;

        let db = Database { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<(), AppError> {
        let user_version: i32 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;

        match user_version {
            0 => {
                self.init_tables()?;
                self.ensure_indexes()?;
                self.migrate_to_v2()?;
                self.migrate_to_v3()?;
                self.conn.execute_batch("PRAGMA user_version = 3;")?;
                Ok(())
            }
            1 => {
                self.ensure_indexes()?;
                self.migrate_to_v2()?;
                self.migrate_to_v3()?;
                self.conn.execute_batch("PRAGMA user_version = 3;")?;
                Ok(())
            }
            2 => {
                self.ensure_indexes()?;
                self.migrate_to_v3()?;
                self.conn.execute_batch("PRAGMA user_version = 3;")?;
                Ok(())
            }
            3 => self.ensure_indexes(),
            other => Err(AppError::new(
                "DB_VERSION_UNSUPPORTED",
                format!("数据库版本不支持: {}", other),
            )),
        }
    }

    fn init_tables(&self) -> Result<(), AppError> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY,
                password_hash TEXT NOT NULL UNIQUE
            )",
            [],
        )?;

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

    fn ensure_indexes(&self) -> Result<(), AppError> {
        self.conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
            CREATE INDEX IF NOT EXISTS idx_inbound_product_created_at ON inbound_orders(product_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_outbound_product_created_at ON outbound_orders(product_id, created_at);
            ",
        )?;
        Ok(())
    }

    fn migrate_to_v2(&self) -> Result<(), AppError> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )?;
        self.conn.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('low_stock_threshold', '10')",
            [],
        )?;
        Ok(())
    }

    fn migrate_to_v3(&self) -> Result<(), AppError> {
        self.conn.execute_batch(
            "
            CREATE TRIGGER IF NOT EXISTS trg_products_stock_nonnegative_insert
            BEFORE INSERT ON products
            FOR EACH ROW
            WHEN NEW.stock < 0
            BEGIN
              SELECT RAISE(ABORT, '库存不能为负');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_products_stock_nonnegative_update
            BEFORE UPDATE OF stock ON products
            FOR EACH ROW
            WHEN NEW.stock < 0
            BEGIN
              SELECT RAISE(ABORT, '库存不能为负');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_inbound_orders_quantity_positive
            BEFORE INSERT ON inbound_orders
            FOR EACH ROW
            WHEN NEW.quantity <= 0
            BEGIN
              SELECT RAISE(ABORT, '数量必须大于 0');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_outbound_orders_quantity_positive
            BEFORE INSERT ON outbound_orders
            FOR EACH ROW
            WHEN NEW.quantity <= 0
            BEGIN
              SELECT RAISE(ABORT, '数量必须大于 0');
            END;
            ",
        )?;
        Ok(())
    }

    pub fn get_low_stock_threshold(&self) -> Result<i32, AppError> {
        let result: Result<String, rusqlite::Error> = self.conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'low_stock_threshold'",
            [],
            |row| row.get(0),
        );
        match result {
            Ok(value) => value
                .parse::<i32>()
                .map_err(|e| AppError::new("SETTING_INVALID", e.to_string())),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(10),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_low_stock_threshold(&mut self, threshold: i32) -> Result<(), AppError> {
        if threshold <= 0 {
            return Err(AppError::new("SETTING_INVALID", "阈值必须大于 0"));
        }
        self.conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('low_stock_threshold', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![threshold.to_string()],
        )?;
        Ok(())
    }

    pub fn has_password(&self) -> Result<bool, AppError> {
        let mut stmt = self
            .conn
            .prepare("SELECT COUNT(*) as count FROM passwords")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn set_password(&self, password_hash: &str) -> Result<(), AppError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO passwords (id, password_hash) VALUES (1, ?)",
            [password_hash],
        )?;
        Ok(())
    }

    pub fn get_password_hash(&self) -> Result<Option<String>, AppError> {
        let mut stmt = self
            .conn
            .prepare("SELECT password_hash FROM passwords WHERE id = 1")?;
        let result = stmt.query_row([], |row| row.get(0));
        match result {
            Ok(hash) => Ok(Some(hash)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
        .map_err(Into::into)
    }

    pub fn add_product(
        &mut self,
        name: &str,
        category: &str,
        unit: &str,
        cost_price: f64,
        sell_price: f64,
        stock: i32,
    ) -> Result<i64, AppError> {
        if name.trim().is_empty() {
            return Err(AppError::new("VALIDATION_ERROR", "商品名称不能为空"));
        }
        if unit.trim().is_empty() {
            return Err(AppError::new("VALIDATION_ERROR", "单位不能为空"));
        }
        if cost_price < 0.0 || sell_price < 0.0 {
            return Err(AppError::new("VALIDATION_ERROR", "价格不能为负"));
        }
        if stock < 0 {
            return Err(AppError::new("STOCK_NEGATIVE", "库存不能为负"));
        }
        self.conn.execute(
            "INSERT INTO products (name, category, unit, cost_price, sell_price, stock) VALUES (?, ?, ?, ?, ?, ?)",
            params![name, category, unit, cost_price, sell_price, stock],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_product(
        &mut self,
        id: i64,
        name: &str,
        category: &str,
        unit: &str,
        cost_price: f64,
        sell_price: f64,
        stock: i32,
    ) -> Result<(), AppError> {
        if name.trim().is_empty() {
            return Err(AppError::new("VALIDATION_ERROR", "商品名称不能为空"));
        }
        if unit.trim().is_empty() {
            return Err(AppError::new("VALIDATION_ERROR", "单位不能为空"));
        }
        if cost_price < 0.0 || sell_price < 0.0 {
            return Err(AppError::new("VALIDATION_ERROR", "价格不能为负"));
        }
        if stock < 0 {
            return Err(AppError::new("STOCK_NEGATIVE", "库存不能为负"));
        }
        self.conn.execute(
            "UPDATE products SET name = ?, category = ?, unit = ?, cost_price = ?, sell_price = ?, stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            params![name, category, unit, cost_price, sell_price, stock, id],
        )?;
        Ok(())
    }

    pub fn delete_product(&mut self, id: i64) -> Result<(), AppError> {
        self.conn
            .execute("DELETE FROM products WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn get_products(&self) -> Result<Vec<serde_json::Value>, AppError> {
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

    pub fn add_inbound(
        &mut self,
        product_id: i64,
        quantity: i32,
        price: f64,
        supplier: &str,
    ) -> Result<i64, AppError> {
        if quantity <= 0 {
            return Err(AppError::new("VALIDATION_ERROR", "数量必须大于 0"));
        }
        if price < 0.0 {
            return Err(AppError::new("VALIDATION_ERROR", "单价不能为负"));
        }
        let total = quantity as f64 * price;

        let tx = self.conn.transaction()?;

        tx.execute(
            "INSERT INTO inbound_orders (product_id, quantity, price, total, supplier) VALUES (?, ?, ?, ?, ?)",
            params![product_id, quantity, price, total, supplier],
        )?;
        let row_id = tx.last_insert_rowid();

        tx.execute(
            "UPDATE products SET stock = stock + ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            params![quantity, product_id],
        )?;

        tx.commit()?;
        Ok(row_id)
    }

    pub fn add_outbound(
        &mut self,
        product_id: i64,
        quantity: i32,
        price: f64,
        customer: &str,
    ) -> Result<i64, AppError> {
        if quantity <= 0 {
            return Err(AppError::new("VALIDATION_ERROR", "数量必须大于 0"));
        }
        if price < 0.0 {
            return Err(AppError::new("VALIDATION_ERROR", "单价不能为负"));
        }
        let total = quantity as f64 * price;

        let tx = self.conn.transaction()?;

        let current_stock: i32 = tx.query_row(
            "SELECT stock FROM products WHERE id = ?",
            params![product_id],
            |row| row.get(0),
        )?;

        if current_stock < quantity {
            return Err(AppError::new("STOCK_INSUFFICIENT", "库存不足"));
        }

        tx.execute(
            "INSERT INTO outbound_orders (product_id, quantity, price, total, customer) VALUES (?, ?, ?, ?, ?)",
            params![product_id, quantity, price, total, customer],
        )?;
        let row_id = tx.last_insert_rowid();

        tx.execute(
            "UPDATE products SET stock = stock - ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            params![quantity, product_id],
        )?;

        tx.commit()?;
        Ok(row_id)
    }

    pub fn get_statistics(&self) -> Result<serde_json::Value, AppError> {
        let product_count: i64 =
            self.conn
                .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))?;

        // 库存总数
        let total_stock: i64 =
            self.conn
                .query_row("SELECT COALESCE(SUM(stock), 0) FROM products", [], |row| {
                    row.get(0)
                })?;

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
    pub fn get_inbound_records(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<serde_json::Value>, AppError> {
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
    pub fn get_product_suggestions(&self, name: &str) -> Result<Vec<serde_json::Value>, AppError> {
        let pattern = format!("%{}%", name);
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT category, unit, cost_price, sell_price 
             FROM products 
             WHERE name LIKE ? AND category IS NOT NULL AND category != ''
             ORDER BY updated_at DESC 
             LIMIT 3",
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

    // 获取销售趋势 - 近7天 vs 上月同期7天
    pub fn get_sales_trend(&self) -> Result<serde_json::Value, AppError> {
        let mut daily = Vec::new();
        for i in (0..7).rev() {
            let date: String = self.conn.query_row(
                &format!("SELECT date('now', 'localtime', '-{} days')", i),
                [],
                |row| row.get(0),
            )?;
            let amount: f64 = self.conn.query_row(
                "SELECT COALESCE(SUM(total), 0) FROM outbound_orders WHERE date(created_at) = ?",
                [&date],
                |row| row.get(0),
            )?;
            daily.push(serde_json::json!({ "date": date, "amount": amount }));
        }

        // 上月同期7天销售额
        let mut last_period_daily = Vec::new();
        for i in (0..7).rev() {
            let date: String = self.conn.query_row(
                &format!("SELECT date('now', 'localtime', '-1 month', '-{} days')", i),
                [],
                |row| row.get(0),
            )?;
            let amount: f64 = self.conn.query_row(
                "SELECT COALESCE(SUM(total), 0) FROM outbound_orders WHERE date(created_at) = ?",
                [&date],
                |row| row.get(0),
            )?;
            last_period_daily.push(serde_json::json!({ "date": date, "amount": amount }));
        }

        Ok(serde_json::json!({
            "daily": daily,
            "last_period_daily": last_period_daily,
        }))
    }

    // 获取滞销商品 - 指定天数内没有出库记录
    pub fn get_slow_moving_products(&self, days: i32) -> Result<Vec<serde_json::Value>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.category, p.stock, p.unit,
                    COALESCE(MAX(o.created_at), '无记录') as last_outbound
             FROM products p
             LEFT JOIN outbound_orders o ON p.id = o.product_id
             GROUP BY p.id
             HAVING last_outbound = '无记录'
                OR julianday('now', 'localtime') - julianday(last_outbound) > ?
             ORDER BY last_outbound ASC",
        )?;

        let rows = stmt.query_map([days], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "stock": row.get::<_, i32>(3)?,
                "unit": row.get::<_, String>(4)?,
                "last_outbound": row.get::<_, String>(5)?,
            }))
        })?;

        let mut products = Vec::new();
        for row in rows {
            products.push(row?);
        }
        Ok(products)
    }

    // 获取经营周报数据
    pub fn get_weekly_report(&self) -> Result<serde_json::Value, AppError> {
        let current_sales: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM outbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let current_purchase: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM inbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let current_profit: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(ob.quantity * (ob.price - p.cost_price)), 0)
             FROM outbound_orders ob JOIN products p ON ob.product_id = p.id
             WHERE ob.created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let current_new_products: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM products WHERE created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let current_inbound_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM inbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let current_outbound_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM outbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;

        // 上周数据
        let previous_sales: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM outbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-13 days') AND created_at < date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let previous_purchase: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM inbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-13 days') AND created_at < date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let previous_profit: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(ob.quantity * (ob.price - p.cost_price)), 0)
             FROM outbound_orders ob JOIN products p ON ob.product_id = p.id
             WHERE ob.created_at >= date('now', 'localtime', 'weekday 0', '-13 days') AND ob.created_at < date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let previous_inbound_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM inbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-13 days') AND created_at < date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;
        let previous_outbound_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM outbound_orders WHERE created_at >= date('now', 'localtime', 'weekday 0', '-13 days') AND created_at < date('now', 'localtime', 'weekday 0', '-6 days')",
            [],
            |row| row.get(0),
        )?;

        Ok(serde_json::json!({
            "current": {
                "sales": current_sales,
                "purchase": current_purchase,
                "profit": current_profit,
                "new_products": current_new_products,
                "inbound_count": current_inbound_count,
                "outbound_count": current_outbound_count,
            },
            "previous": {
                "sales": previous_sales,
                "purchase": previous_purchase,
                "profit": previous_profit,
                "inbound_count": previous_inbound_count,
                "outbound_count": previous_outbound_count,
            }
        }))
    }

    // 获取低库存预警商品
    pub fn get_low_stock_products(&self) -> Result<Vec<serde_json::Value>, AppError> {
        let threshold = self.get_low_stock_threshold()?;
        let mut stmt = self.conn.prepare(
            "SELECT id, name, category, unit, cost_price, sell_price, stock 
             FROM products 
             WHERE stock < ? 
             ORDER BY stock ASC",
        )?;

        let rows = stmt.query_map(params![threshold], |row| {
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
    pub fn get_outbound_records(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<serde_json::Value>, AppError> {
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
