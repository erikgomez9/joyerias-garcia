export type Metal =
  | "plata"
  | "oro"
  | "acero"
  | "rodio"
  | "oro_laminado"
  | "otro";

export type ProductStatus =
  | "disponible"
  | "reservado"
  | "vendido"
  | "taller"
  | "danado";

export interface DamageRecord {
  id: string;
  productId: string;
  sku: string;
  name: string;
  qty: number;
  reason: string;
  notes?: string;
  stockAfter?: number;
  saleId?: string;
  orderId?: string;
  warrantyCaseId?: string;
  at: string;
}

export type WarrantyType = "same_value" | "price_difference" | "refund";

export interface WarrantyCaseRecord {
  id: string;
  type: WarrantyType;
  originalSaleId: string;
  originalOrderId?: string;
  originalLineIndex?: number;
  originalSku: string;
  originalName: string;
  originalQty: number;
  originalUnitPrice: number;
  returnedProductId?: string;
  replacementProductId?: string;
  replacementQty?: number;
  chargedAmount: number;
  refundAmount: number;
  payment?: SalePaymentMethod;
  damageId?: string;
  adjustmentSaleId?: string;
  notes?: string;
  at: string;
}

export type ProductCategory =
  | "Anillos"
  | "Cadenas"
  | "Aretes"
  | "Pulseras"
  | "Dijes"
  | "Relojes"
  | "Otros";

/** catalog = mismo SKU, stock > 1 · unique = una pieza, stock 1 */
export type InventoryMode = "catalog" | "unique";

export interface Product {
  id: string;
  /** Código interno generado por el sistema */
  sku: string;
  /** Código de barras generado por el sistema (Code128) */
  barcode: string;
  name: string;
  category: ProductCategory | string;
  metal?: Metal;
  /** Nombre libre cuando metal es "otro" */
  metalOther?: string;
  stones?: string;
  /** Peso en gramos */
  weightGrams?: number;
  /** Precio mayoreo */
  priceMayoreo: number;
  /** Precio menudeo */
  priceMenudeo: number;
  inventoryMode?: InventoryMode;
  stock: number;
  status: ProductStatus;
  image: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  /** Opcional al crear; si no se envía, se genera (ej. AR001). */
  sku?: string;
  barcode?: string;
  category: ProductCategory | string;
  metal?: Metal;
  /** Nombre libre cuando metal es "otro" */
  metalOther?: string;
  stones?: string;
  weightGrams?: number;
  priceMayoreo: number;
  priceMenudeo: number;
  inventoryMode?: InventoryMode;
  stock: number;
  status?: ProductStatus;
  image?: string;
  notes?: string;
}

export interface CartLine {
  product: Product;
  qty: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientInput {
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

export type OrderKind = "encargo" | "apartado" | "reparacion";

export type OrderStatus =
  | "pendiente"
  | "listo"
  | "entregado"
  | "cancelado";

export interface OrderLine {
  productId?: string;
  sku?: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface OrderPayment {
  amount: number;
  paidAt: string;
}

export interface OrderRecord {
  id: string;
  orderCode: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  kind: OrderKind;
  status: OrderStatus;
  title: string;
  description?: string;
  items: OrderLine[];
  productId?: string;
  productName?: string;
  totalAmount: number;
  depositPaid: number;
  payments: OrderPayment[];
  saleId?: string;
  /** Piezas ya separadas del stock al crear el pedido. */
  inventoryHeld?: boolean;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderInput {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  kind: OrderKind;
  title?: string;
  description?: string;
  items: OrderLine[];
  depositPaid?: number;
}

export type SalePaymentMethod =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "mixto"
  | "pedido";

/** Desglose cuando payment es "mixto". */
export interface PaymentMix {
  efectivo?: number;
  tarjeta?: number;
  transferencia?: number;
}

export type SaleKind = "normal" | "warranty";

export type SaleWarrantyType = "exchange_same" | "exchange_diff" | "refund";

export interface SaleRecord {
  id: string;
  at: string;
  total: number;
  items: {
    productId?: string;
    name: string;
    sku?: string;
    qty: number;
    unitPrice: number;
  }[];
  payment: SalePaymentMethod;
  paymentMix?: PaymentMix;
  seller: string;
  orderId?: string;
  /** Folio del pedido si la venta se generó al entregar un pedido. */
  orderCode?: string;
  kind?: SaleKind;
  warrantyType?: SaleWarrantyType;
  originalSaleId?: string;
  warrantyCaseId?: string;
}
