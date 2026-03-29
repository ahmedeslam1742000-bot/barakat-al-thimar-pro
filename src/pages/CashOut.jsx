import VoucherWorkspace from './vouchers/VoucherWorkspace';

/** سند إخراج صوري (عهدة مندوب) — أدوات التصدير والتصفية (انظر VoucherWorkspace). */
export default function CashOut() {
  return <VoucherWorkspace kind="outward" />;
}
