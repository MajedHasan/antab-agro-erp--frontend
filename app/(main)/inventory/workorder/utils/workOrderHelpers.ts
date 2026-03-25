export const formatCurrency = (amount: number) => {
  return `৳ ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const calculateTotals = (items: any[]) => {
  let subTotal = 0;

  items.forEach((item) => {
    subTotal += item.quantity * item.unitPrice;
  });

  return {
    subTotal,
    taxTotal: 0,
    grandTotal: subTotal,
  };
};

export const numberToWords = (num: number) => {
  if (!num) return "Zero";
  return num.toLocaleString(); // Replace with full converter if needed
};
