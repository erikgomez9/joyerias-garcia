import type { SalesPeriod } from "@/lib/saleDateFilter";
import type {
  Client,
  ClientInput,
  OrderInput,
  OrderRecord,
  PaymentMix,
  Product,
  ProductInput,
  SaleRecord,
} from "@/types";
import type { DamageRecord, WarrantyCaseRecord, WarrantyType } from "@/types";
import type { LiveSalesReport } from "@/types/reports";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* respuesta no JSON */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function isMongoApiAvailable(): Promise<boolean> {
  try {
    const health = await request<{ ok: boolean; mongo: string }>("/health");
    return health.ok && health.mongo === "connected";
  } catch {
    return false;
  }
}

export const productsApi = {
  list(): Promise<Product[]> {
    return request<Product[]>("/products");
  },

  create(input: ProductInput): Promise<Product> {
    return request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, patch: Partial<ProductInput>): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  adjustStock(id: string, delta: number): Promise<Product> {
    return request<Product>(`/products/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ delta }),
    });
  },

  remove(id: string): Promise<void> {
    return request<void>(`/products/${id}`, { method: "DELETE" });
  },
};

export const salesApi = {
  list(): Promise<SaleRecord[]> {
    return request<SaleRecord[]>("/sales");
  },

  checkout(payload: {
    payment: SaleRecord["payment"];
    paymentMix?: PaymentMix;
    seller?: string;
    items: {
      productId: string;
      qty: number;
      unitPrice: number;
    }[];
  }): Promise<SaleRecord> {
    return request<SaleRecord>("/sales/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const clientsApi = {
  list(): Promise<Client[]> {
    return request<Client[]>("/clients");
  },

  create(input: ClientInput): Promise<Client> {
    return request<Client>("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, patch: Partial<ClientInput>): Promise<Client> {
    return request<Client>(`/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  remove(id: string): Promise<void> {
    return request<void>(`/clients/${id}`, { method: "DELETE" });
  },
};

export const ordersApi = {
  list(): Promise<OrderRecord[]> {
    return request<OrderRecord[]>("/orders");
  },

  create(input: OrderInput): Promise<OrderRecord> {
    return request<OrderRecord>("/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(
    id: string,
    patch: Partial<
      Pick<OrderRecord, "status" | "description" | "items">
    >
  ): Promise<OrderRecord> {
    return request<OrderRecord>(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  addDeposit(id: string, amount: number): Promise<OrderRecord> {
    return request<OrderRecord>(`/orders/${id}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },
};

export const warrantiesApi = {
  list(): Promise<WarrantyCaseRecord[]> {
    return request<WarrantyCaseRecord[]>("/warranties");
  },

  create(payload: {
    type: WarrantyType;
    originalSaleId: string;
    originalLineIndex?: number;
    originalLineSku?: string;
    /** Piezas defectuosas de esa línea (ej. 1 de 10). */
    returnQty?: number;
    returnedProductId?: string;
    replacementProductId?: string;
    replacementQty?: number;
    chargedAmount?: number;
    refundAmount?: number;
    priceTier?: "menudeo" | "mayoreo";
    payment?: SaleRecord["payment"];
    paymentMix?: PaymentMix;
    notes?: string;
  }): Promise<{
    warranty: WarrantyCaseRecord;
    damage: DamageRecord;
    adjustmentSale: SaleRecord;
  }> {
    return request("/warranties", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const damagesApi = {
  list(): Promise<DamageRecord[]> {
    return request<DamageRecord[]>("/damages");
  },

  report(payload: {
    productId: string;
    qty: number;
    reason: string;
    notes?: string;
  }): Promise<{ damage: DamageRecord; product: Product }> {
    return request<{ damage: DamageRecord; product: Product }>("/damages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const reportsApi = {
  live(period: SalesPeriod = "month"): Promise<LiveSalesReport> {
    const q = new URLSearchParams({ period });
    return request<LiveSalesReport>(`/reports/live?${q}`);
  },
};
