export type CommissionSaleLine = {
  id: string;
  at: string;
  total: number;
  commission: number;
  payment: string;
};

export type CommissionSellerRow = {
  seller: string;
  salesCount: number;
  salesTotal: number;
  commission: number;
  sales: CommissionSaleLine[];
};

export type CommissionReport = {
  quincenaKey: string;
  quincenaLabel: string;
  rate: number;
  from: string;
  to: string;
  rows: CommissionSellerRow[];
  totals: {
    salesCount: number;
    salesTotal: number;
    commission: number;
  };
};
