export type DayCloseRecord = {
  id: string;
  dayKey: string;
  closedAt: string;
  summary: {
    tickets: number;
    total: number;
    avgTicket: number;
    pieces: number;
  };
  byPayment: { label: string; amount: number }[];
  byPriceTier: { label: string; amount: number }[];
  createdAt: string;
  updatedAt: string;
};
