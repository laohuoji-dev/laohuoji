mod db;
mod error;

use bcrypt::{hash, verify, DEFAULT_COST};
use db::Database;
use error::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};

// 应用状态
struct AppState {
    db: Mutex<Option<Database>>,
}

// 数据结构
#[derive(Serialize, Deserialize)]
struct Product {
    name: String,
    category: String,
    unit: String,
    cost_price: f64,
    sell_price: f64,
    stock: i32,
    barcode: Option<String>,
    status: Option<String>,
    min_stock: Option<i32>,
}

#[derive(Serialize, Deserialize)]
struct InboundOrder {
    product_id: i64,
    quantity: i32,
    price: f64,
    supplier: String,
    paid_amount: Option<f64>,
}

#[derive(Serialize, Deserialize)]
struct OutboundOrder {
    product_id: i64,
    quantity: i32,
    price: f64,
    customer: String,
    paid_amount: Option<f64>,
}

// 密码相关命令
#[tauri::command]
async fn init_database(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    let db = Database::new(&app)?;

    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    *db_guard = Some(db);

    Ok(())
}

#[tauri::command]
async fn has_password(state: State<'_, AppState>) -> Result<bool, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.has_password()
}

#[tauri::command]
async fn setup_password(password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    let hashed = hash(&password, DEFAULT_COST)
        .map_err(|e| AppError::new("PASSWORD_HASH_ERROR", e.to_string()))?;
    db.set_password(&hashed)?;

    Ok(())
}

#[tauri::command]
async fn verify_password(password: String, state: State<'_, AppState>) -> Result<bool, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    let stored_hash = db.get_password_hash()?;

    match stored_hash {
        Some(hash) => verify(&password, &hash)
            .map_err(|e| AppError::new("PASSWORD_VERIFY_ERROR", e.to_string())),
        None => Ok(false),
    }
}

#[tauri::command]
async fn change_password(password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    let hashed = hash(&password, DEFAULT_COST)
        .map_err(|e| AppError::new("PASSWORD_HASH_ERROR", e.to_string()))?;
    db.set_password(&hashed)?;

    Ok(())
}

// 往来单位命令
#[tauri::command]
async fn get_customers(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_customers()
}

#[tauri::command]
async fn add_customer(
    name: String,
    contact: Option<String>,
    phone: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.add_customer(&name, contact.as_deref(), phone.as_deref())
}

#[tauri::command]
async fn update_customer(
    id: i64,
    name: String,
    contact: Option<String>,
    phone: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.update_customer(id, &name, contact.as_deref(), phone.as_deref())
}

#[tauri::command]
async fn delete_customer(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.delete_customer(id)
}

#[tauri::command]
async fn get_suppliers(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_suppliers()
}

#[tauri::command]
async fn add_supplier(
    name: String,
    contact: Option<String>,
    phone: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.add_supplier(&name, contact.as_deref(), phone.as_deref())
}

#[tauri::command]
async fn update_supplier(
    id: i64,
    name: String,
    contact: Option<String>,
    phone: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.update_supplier(id, &name, contact.as_deref(), phone.as_deref())
}

#[tauri::command]
async fn delete_supplier(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.delete_supplier(id)
}

// 分类与单位管理命令
#[tauri::command]
async fn get_categories(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_categories()
}

#[tauri::command]
async fn add_category(name: String, state: State<'_, AppState>) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.add_category(&name)
}

#[tauri::command]
async fn delete_category(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.delete_category(id)
}

#[tauri::command]
async fn get_units(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_units()
}

#[tauri::command]
async fn add_unit(name: String, state: State<'_, AppState>) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.add_unit(&name)
}

#[tauri::command]
async fn delete_unit(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.delete_unit(id)
}

// 商品管理命令
#[tauri::command]
async fn add_product(product: Product, state: State<'_, AppState>) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.add_product(
        &product.name,
        &product.category,
        &product.unit,
        product.cost_price,
        product.sell_price,
        product.stock,
        product.barcode.as_deref(),
        product.status.as_deref().unwrap_or("ACTIVE"),
        product.min_stock.unwrap_or(0),
    )
}

#[tauri::command]
async fn update_product(
    id: i64,
    product: Product,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.update_product(
        id,
        &product.name,
        &product.category,
        &product.unit,
        product.cost_price,
        product.sell_price,
        product.stock,
        product.barcode.as_deref(),
        product.status.as_deref().unwrap_or("ACTIVE"),
        product.min_stock.unwrap_or(0),
    )
}

#[tauri::command]
async fn delete_product(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.delete_product(id)
}

#[tauri::command]
async fn get_products(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_products()
}

#[tauri::command]
async fn import_products(
    products: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.import_products(products)
}

#[tauri::command]
async fn batch_update_stock(
    adjustments: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.batch_update_stock(adjustments)
}

// 入库出库命令
#[tauri::command]
async fn add_inbound(order: InboundOrder, state: State<'_, AppState>) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    // In frontend, we will pass paid_amount, but InboundOrder struct needs update.
    // If we haven't updated it yet, it might fail. Let's update the struct too.
    db.add_inbound(
        order.product_id,
        order.quantity,
        order.price,
        &order.supplier,
        order.paid_amount.unwrap_or(0.0),
    )
}

#[tauri::command]
async fn add_outbound(order: OutboundOrder, state: State<'_, AppState>) -> Result<i64, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.add_outbound(
        order.product_id,
        order.quantity,
        order.price,
        &order.customer,
        order.paid_amount.unwrap_or(0.0),
    )
}

#[tauri::command]
async fn add_payment(
    partner_type: String,
    partner_name: String,
    amount: f64,
    remark: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.add_payment(&partner_type, &partner_name, amount, &remark)
}

#[tauri::command]
async fn get_financial_logs(
    partner_type: String,
    partner_name: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_financial_logs(&partner_type, &partner_name)
}

// 统计命令
#[tauri::command]
async fn get_statistics(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_statistics()
}

// 智能补全命令
#[tauri::command]
async fn get_product_suggestions(
    name: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_product_suggestions(&name)
}

// 销售趋势命令
#[tauri::command]
async fn get_sales_trend(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_sales_trend()
}

// 滞销商品命令
#[tauri::command]
async fn get_slow_moving_products(
    days: i32,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_slow_moving_products(days)
}

// 经营周报命令
#[tauri::command]
async fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_dashboard_stats()
}

#[tauri::command]
async fn get_weekly_report(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_weekly_report()
}

#[tauri::command]
async fn get_customer_statement(
    customer: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_customer_statement(
        customer.as_deref(),
        start_date.as_deref(),
        end_date.as_deref(),
    )
}

#[tauri::command]
async fn get_supplier_statement(
    supplier: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_supplier_statement(
        supplier.as_deref(),
        start_date.as_deref(),
        end_date.as_deref(),
    )
}

// 库存预警命令
#[tauri::command]
async fn get_low_stock_products(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_low_stock_products()
}

#[tauri::command]
async fn get_low_stock_threshold(state: State<'_, AppState>) -> Result<i32, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_low_stock_threshold()
}

#[tauri::command]
async fn set_low_stock_threshold(
    threshold: i32,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.set_low_stock_threshold(threshold)
}

#[tauri::command]
async fn get_company_info(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_company_info()
}

#[tauri::command]
async fn set_company_info(
    name: String,
    phone: String,
    address: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.set_company_info(&name, &phone, &address)
}

#[tauri::command]
async fn get_auto_backup_config(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.get_auto_backup_config()
}

#[tauri::command]
async fn set_auto_backup_config(
    enabled: bool,
    days: i32,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;
    db.set_auto_backup_config(enabled, days)
}

// 记录查询命令
#[tauri::command]
async fn get_inbound_records(
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_inbound_records(start_date.as_deref(), end_date.as_deref())
}

#[tauri::command]
async fn get_outbound_records(
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_outbound_records(start_date.as_deref(), end_date.as_deref())
}

#[tauri::command]
async fn get_inventory_logs(
    product_id: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.get_inventory_logs(product_id, start_date.as_deref(), end_date.as_deref())
}

#[tauri::command]
async fn batch_update_prices(
    updates: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_mut()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    // 解析更新数据：[{id: 1, newPrice: 99.99}, ...]
    let product_ids: Vec<i64> = updates
        .iter()
        .filter_map(|v| v.get("id").and_then(|id| id.as_i64()))
        .collect();
    
    let new_prices: Vec<f64> = updates
        .iter()
        .filter_map(|v| v.get("newPrice").and_then(|p| p.as_f64()))
        .collect();

    if product_ids.len() != new_prices.len() {
        return Err(AppError::new("INVALID_DATA", "更新数据格式错误"));
    }

    db.batch_update_prices_simple(&product_ids, &new_prices)
}

#[tauri::command]
async fn export_products(
    category: Option<String>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    let db = db_guard
        .as_ref()
        .ok_or_else(|| AppError::new("DB_NOT_INIT", "数据库未初始化"))?;

    db.export_products(category.as_deref(), status.as_deref())
}

#[tauri::command]
async fn backup_database(
    target_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let db_path = Database::get_db_path(&app_handle)?;
    std::fs::copy(&db_path, &target_path)
        .map_err(|e| AppError::new("BACKUP_ERROR", format!("备份失败: {}", e)))?;
    Ok(())
}

#[tauri::command]
async fn restore_database(
    source_path: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_path = Database::get_db_path(&app_handle)?;

    // 断开现有数据库连接以允许文件替换
    {
        let mut db_guard = state
            .db
            .lock()
            .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
        *db_guard = None;
    }

    // 执行覆盖
    std::fs::copy(&source_path, &db_path)
        .map_err(|e| AppError::new("RESTORE_ERROR", format!("恢复失败: {}", e)))?;

    // 重新建立连接
    let new_db = Database::new(&app_handle)?;
    let mut db_guard = state
        .db
        .lock()
        .map_err(|e| AppError::new("LOCK_ERROR", e.to_string()))?;
    *db_guard = Some(new_db);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            init_database,
            has_password,
            setup_password,
            verify_password,
            change_password,
            add_product,
            update_product,
            delete_product,
            get_products,
            add_inbound,
            add_outbound,
            get_statistics,
            get_product_suggestions,
            get_sales_trend,
            get_slow_moving_products,
            get_dashboard_stats,
            get_weekly_report,
            get_customer_statement,
            get_supplier_statement,
            get_low_stock_products,
            get_low_stock_threshold,
            set_low_stock_threshold,
            get_company_info,
            set_company_info,
            get_auto_backup_config,
            set_auto_backup_config,
            get_inbound_records,
            get_outbound_records,
            get_inventory_logs,
            backup_database,
            restore_database,
            get_categories,
            add_category,
            delete_category,
            get_units,
            add_unit,
            delete_unit,
            get_customers,
            add_customer,
            update_customer,
            delete_customer,
            get_suppliers,
            add_supplier,
            update_supplier,
            delete_supplier,
            import_products,
            batch_update_stock,
            batch_update_prices,
            export_products,
            add_payment,
            get_financial_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
