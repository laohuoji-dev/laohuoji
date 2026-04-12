# 老伙计 — 单机版进销存管理系统

一个简单好用的单机版进销存软件，使用 Tauri + React + SQLite 构建。

## 功能特性

- 🔐 密码保护 - 简单的登录验证
- 📦 商品管理 - 添加、编辑、删除商品
- 📥 入库管理 - 采购入库，自动更新库存
- 📤 出库管理 - 销售出库，库存不足提醒
- 📊 数据统计 - 实时库存、销售、利润统计

## 技术栈

- **前端**: React 19 + TypeScript + Ant Design
- **后端**: Tauri 2 (Rust)
- **数据库**: SQLite

## 开发环境要求

### 必需依赖

1. **Node.js** (v18+)
2. **Rust** - 用于编译 Tauri 后端
3. **系统依赖** (Linux)
   - webkit2gtk
   - rsvg2

### 安装依赖

**Ubuntu/Debian:**
```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 webkit2gtk
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

**macOS:**
```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Windows:**
```bash
# 安装 Rust
# 下载并运行: https://rustup.rs/
# 安装 Microsoft C++ Build Tools
# 下载: https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

## 安装与运行

### 1. 克隆仓库
```bash
git clone git@github.com:laohuoji-dev/laohuoji.git
cd laohuoji
```

### 2. 安装 npm 依赖
```bash
npm install
```

### 3. 开发模式运行
```bash
npm run tauri dev
```

### 4. 打包成应用
```bash
# 打包当前平台应用
npm run tauri build

# 打包后的应用位于:
# - Windows: src-tauri/target/release/bundle/msi/
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/deb/ 或 appimage/
```

## 使用说明

### 首次使用
1. 启动应用后，首次需要设置管理员密码
2. 设置密码后，使用该密码登录系统

### 商品管理
- 添加商品：填写名称、分类、单位、成本价、销售价、初始库存
- 编辑商品：点击编辑按钮修改商品信息
- 删除商品：确认后删除商品

### 入库操作
1. 选择商品
2. 填写入库数量和单价
3. 选择供应商（可选）
4. 确认入库，库存自动增加

### 出库操作
1. 选择商品
2. 填写出库数量和单价
3. 填写客户信息（可选）
4. 确认出库，库存自动减少
5. 库存不足时会提示

## 数据存储

所有数据存储在本地 SQLite 数据库中：

- **Windows**: `C:\Users\<用户名>\AppData\Roaming\com.inventory.app\inventory.db`
- **macOS**: `~/Library/Application Support/com.inventory.app/inventory.db`
- **Linux**: `~/.config/com.inventory.app/inventory.db`

## 项目结构

```
inventory-app/
├── src/                    # React 前端源码
│   ├── pages/             # 页面组件
│   │   ├── Login.tsx      # 登录页
│   │   ├── Dashboard.tsx  # 数据概览
│   │   ├── Products.tsx   # 商品管理
│   │   ├── Inbound.tsx    # 入库管理
│   │   └── Outbound.tsx   # 出库管理
│   ├── App.tsx            # 主应用
│   └── main.tsx           # 入口文件
├── src-tauri/             # Tauri 后端源码
│   ├── src/
│   │   ├── db.rs          # 数据库操作
│   │   ├── lib.rs         # Tauri 命令
│   │   └── main.rs        # Rust 主入口
│   └── Cargo.toml         # Rust 依赖
└── package.json           # Node 依赖
```

## 许可证

MIT
