import {
  Bell, Package, FilePlus2, Upload, BarChart3, Wallet, Palette, Factory, Tag, type LucideIcon,
} from "lucide-react";

// Danh sách MỤC (menu) có thể phân quyền cho từng người + nhóm hiển thị ở sidebar.
export type ModuleDef = { key: string; href: string; label: string; icon: LucideIcon; ffmOnly?: boolean; group: "Vận hành" | "Báo cáo" | "Danh mục" };

export const MODULES: ModuleDef[] = [
  { key: "today", href: "/today", label: "Việc hôm nay", icon: Bell, group: "Vận hành" },
  { key: "orders", href: "/orders", label: "Đơn hàng", icon: Package, group: "Vận hành" },
  { key: "orders_new", href: "/orders/new", label: "Nhập đơn", icon: FilePlus2, group: "Vận hành" },
  { key: "import", href: "/orders/import", label: "Import", icon: Upload, group: "Vận hành" },
  { key: "by_seller", href: "/by-seller", label: "Theo seller", icon: BarChart3, group: "Báo cáo" },
  { key: "finance", href: "/finance", label: "Tài chính", icon: Wallet, ffmOnly: true, group: "Báo cáo" },
  { key: "templates", href: "/templates", label: "Template", icon: Palette, group: "Danh mục" },
  { key: "factories", href: "/factories", label: "Xưởng", icon: Factory, group: "Danh mục" },
  { key: "selling_accounts", href: "/selling-accounts", label: "TK bán", icon: Tag, group: "Danh mục" },
];
