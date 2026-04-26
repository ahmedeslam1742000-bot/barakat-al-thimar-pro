import React from 'react';
import VoucherWorkspace from './vouchers/VoucherWorkspace';

export default function VoucherOutward({ setActiveView }) {
  return <VoucherWorkspace kind="outward" setActiveView={setActiveView} />;
}
