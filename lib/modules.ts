// Danh sách MỤC (menu) có thể phân quyền cho từng người (Admin › Phân quyền).
// Dùng chung cho Sidebar (ẩn/hiện) và ma trận phân quyền.
// Tổng quan & Hồ sơ luôn hiển thị; Nhật ký / Người dùng / Phân quyền chỉ admin.
export type ModuleDef = { key: string; href: string; label: string; icon: string; ffmOnly?: boolean };

export const MODULES: ModuleDef[] = [
  { key: "today", href: "/today", label: "Việc hôm nay", icon: "🔔" },
  { key: "orders_new", href: "/orders/new", label: "Nhập đơn", icon: "📝" },
  { key: "orders", href: "/orders", label: "Đơn hàng", icon: "📦" },
  { key: "by_seller", href: "/by-seller", label: "Theo seller", icon: "📈" },
  { key: "import", href: "/orders/import", label: "Import", icon: "⬆️" },
  { key: "templates", href: "/templates", label: "Template", icon: "🎨" },
  { key: "factories", href: "/factories", label: "Xưởng", icon: "🏭" },
  { key: "selling_accounts", href: "/selling-accounts", label: "TK bán", icon: "🏷️" },
  { key: "finance", href: "/finance", label: "Tài chính", icon: "💰", ffmOnly: true },
];
