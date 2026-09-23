export const formatCurrency = (value: number): string => {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} جنيه`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};
