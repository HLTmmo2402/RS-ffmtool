export type Order = {
  id: string;
  order_date: string | null;
  platform: "AMZ" | "TTS";
  platform_order_id: string;
  platform_status: string | null;
  label_fee: number | null;
  customer_name: string | null;
  customer_contact: string | null;
  tracking_number: string | null;
  label_link: string | null;
  seller_note: string | null;
  created_at: string;
};
