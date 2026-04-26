import React from 'react';
import VoucherWorkspace from './vouchers/VoucherWorkspace';

export default function VoucherIn({ setActiveView }) {
  return <VoucherWorkspace kind="in" setActiveView={setActiveView} />;
}
