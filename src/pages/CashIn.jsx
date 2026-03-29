import VoucherWorkspace from './vouchers/VoucherWorkspace';

/** سند إدخال صوري — أدوات التصدير والتصفية (انظر VoucherWorkspace). */
export default function CashIn() {
  return <VoucherWorkspace kind="in" />;
}
