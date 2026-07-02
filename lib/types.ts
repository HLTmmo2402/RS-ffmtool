export type OrderItemLite = {
  id: string;
  item_status: string;
  confirm_design: boolean;
  product_title: string | null;
  size: string | null;
  tracking_status: string;
};

export type Order = {
  id: string;
  order_date: string | null;
  platform: "AMZ" | "TTS";
  platform_order_id: string;
  platform_status: string | null;
  tracking_number: string | null;
  label_link: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  seller_note: string | null;
  order_value: number | null;
  selling_account_name: string | null;
  seller_name: string | null;
  items: OrderItemLite[];
};
