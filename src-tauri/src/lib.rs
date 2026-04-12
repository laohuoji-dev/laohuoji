mod db;

use bcrypt::{hash, verify, DEFAULT_COST};
use db::Database;
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
}

#[derive(Serialize, Deserialize)]
struct InboundOrder {
    product_id: i64,
    quantity: i32,
    price: f64,
    supplier: String,
}

#[derive(Serialize, Deserialize)]
struct OutboundOrder {
    product_id: i64,
    quantity: i32,
    price: f64,
    customer: String,
}

// 密码相关命令
#[tauri::command]
async fn init_database(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db = Database::new(&app).map_err(|e| e.to_string())?;

    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(db);

    Ok(())
}

#[tauri::command]
async fn has_password(state: State<'_, AppState>) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;
    db.has_password().map_err(|e| e.to_string())
}

#[tauri::command]
async fn setup_password(password: String, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    let hashed = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    db.set_password(&hashed).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn verify_password(password: String, state: State<'_, AppState>) -> Result<bool, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    let stored_hash = db.get_password_hash().map_err(|e| e.to_string())?;

    match stored_hash {
        Some(hash) => verify(&password, &hash).map_err(|e| e.to_string()),
        None => Ok(false),
    }
}

#[tauri::command]
async fn change_password(password: String, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    let hashed = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    db.set_password(&hashed).map_err(|e| e.to_string())?;

    Ok(())
}

// 商品管理命令
#[tauri::command]
async fn add_product(product: Product, state: State<'_, AppState>) -> Result<i64, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.add_product(
        &product.name,
        &product.category,
        &product.unit,
        product.cost_price,
        product.sell_price,
        product.stock,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_product(id: i64, product: Product, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.update_product(
        id,
        &product.name,
        &product.category,
        &product.unit,
        product.cost_price,
        product.sell_price,
        product.stock,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_product(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.delete_product(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_products(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.get_products().map_err(|e| e.to_string())
}

// 入库出库命令
#[tauri::command]
async fn add_inbound(order: InboundOrder, state: State<'_, AppState>) -> Result<i64, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.add_inbound(order.product_id, order.quantity, order.price, &order.supplier)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_outbound(order: OutboundOrder, state: State<'_, AppState>) -> Result<i64, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.add_outbound(order.product_id, order.quantity, order.price, &order.customer)
        .map_err(|e| e.to_string())
}

// 统计命令
#[tauri::command]
async fn get_statistics(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.get_statistics().map_err(|e| e.to_string())
}

// 智能补全命令
#[tauri::command]
async fn get_product_suggestions(name: String, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;
    db.get_product_suggestions(&name).map_err(|e| e.to_string())
}

// 库存预警命令
#[tauri::command]
async fn get_low_stock_products(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.get_low_stock_products().map_err(|e| e.to_string())
}

// 记录查询命令
#[tauri::command]
async fn get_inbound_records(start_date: Option<String>, end_date: Option<String>, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.get_inbound_records(start_date.as_deref(), end_date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_outbound_records(start_date: Option<String>, end_date: Option<String>, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;

    db.get_outbound_records(start_date.as_deref(), end_date.as_deref()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { db: Mutex::new(None) })
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
            get_low_stock_products,
            get_inbound_records,
            get_outbound_records,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
