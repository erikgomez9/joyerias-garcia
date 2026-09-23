import type { SalesPeriod } from "@/lib/saleDateFilter";

export type LiveSalesReport = {
  generatedAt: string;
  period: SalesPeriod;
  summary: {
    tickets: number;
    total: number;
    avgTicket: number;
    pieces: number;
  };
  byPayment: { label: string; amount: number }[];
  starProducts: {
    sku: string;
    name: string;
    qty: number;
    revenue: number;
  }[];
  outOfStock: {
    id: string;
    sku: string;
    name: string;
    category: string;
    stock: number;
    status: string;
  }[];
  lowStock: {
    id: string;
    sku: string;
    name: string;
    category: string;
    stock: number;
    status: string;
  }[];
  recentSales: {
    id: string;
    at: string;
    total: number;
    pieces: number;
    payment: string;
    orderCode?: string;
  }[];
};
