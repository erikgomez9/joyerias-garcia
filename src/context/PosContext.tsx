import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { posProductBlockReason } from "@/lib/productAvailability";
import { mockProducts } from "@/data/mockProducts";
import {
  ApiError,
  clientsApi,
  isMongoApiAvailable,
  ordersApi,
  productsApi,
  salesApi,
} from "@/lib/api";
import { generateSku, uid } from "@/lib/inventoryCodes";
import { applyInventoryModeRules } from "@/lib/inventoryMode";
import { normalizeMetalFields } from "@/lib/materials";
import { productPrice } from "@/lib/format";
import {
  normalizePaymentMix,
  validatePaymentMix,
} from "@/lib/paymentMix";
import { cartTotal, priceTierForCart } from "@/lib/salePricing";
import type {
  CartLine,
  Client,
  ClientInput,
  OrderInput,
  OrderRecord,
  PaymentMix,
  Product,
  ProductInput,
  SaleRecord,
} from "@/types";

const STORAGE_KEY = "jg-inventory-v2";
const SALES_STORAGE_KEY = "jg-sales-v1";

export type InventorySource = "loading" | "mongo" | "local";

type LegacyProduct = Product & { cost?: number; price?: number };

function normalizeProduct(raw: LegacyProduct): Product {
  const priceMayoreo =
    raw.priceMayoreo ?? raw.cost ?? raw.priceMenudeo ?? raw.price ?? 0;
  const priceMenudeo =
    raw.priceMenudeo ?? raw.price ?? raw.priceMayoreo ?? raw.cost ?? 0;
  const { cost: _c, price: _p, ...rest } = raw;
  const metalFields = normalizeMetalFields(rest.metal, rest.metalOther);
  return {
    ...rest,
    ...metalFields,
    priceMayoreo,
    priceMenudeo,
    inventoryMode: "catalog" as const,
  };
}

function loadLocalSales(): SaleRecord[] {
  try {
    const raw = localStorage.getItem(SALES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SaleRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem("jg-inventory-v1");
      if (legacy) {
        const parsed = JSON.parse(legacy) as LegacyProduct[];
        if (Array.isArray(parsed)) return parsed.map(normalizeProduct);
      }
      return mockProducts;
    }
    const parsed = JSON.parse(raw) as LegacyProduct[];
    return Array.isArray(parsed) ? parsed.map(normalizeProduct) : mockProducts;
  } catch {
    return mockProducts;
  }
}

interface PosState {
  products: Product[];
  cart: CartLine[];
  sales: SaleRecord[];
  clients: Client[];
  orders: OrderRecord[];
  inventorySource: InventorySource;
  inventoryError: string | null;
  refreshInventory: () => Promise<void>;
  refreshProductsQuiet: () => Promise<void>;
  refreshSalesQuiet: () => Promise<void>;
  addToCart: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clearCart: () => void;
  checkout: (
    payment: SaleRecord["payment"],
    paymentMix?: PaymentMix
  ) => Promise<SaleRecord>;
  createProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<ProductInput>) => Promise<void>;
  adjustStock: (id: string, delta: number) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  setProducts: (p: Product[]) => void;
  createClient: (input: ClientInput) => Promise<Client>;
  updateClient: (id: string, patch: Partial<ClientInput>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  createOrder: (input: OrderInput) => Promise<OrderRecord>;
  updateOrder: (
    id: string,
    patch: Parameters<typeof ordersApi.update>[1]
  ) => Promise<OrderRecord>;
  addOrderDeposit: (id: string, amount: number) => Promise<OrderRecord>;
}

const PosContext = createContext<PosState | null>(null);

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80";

function buildLocalProduct(input: ProductInput, prev: Product[]): Product {
  const now = new Date().toISOString();
  const normalized = applyInventoryModeRules(input);
  const code = generateSku(normalized.category, prev);
  const sku = code;
  const barcode = code;
  return {
    id: uid(),
    sku,
    barcode,
    name: normalized.name.trim(),
    category: normalized.category,
    metal: normalized.metal,
    metalOther:
      normalized.metal === "otro"
        ? normalized.metalOther?.trim() || undefined
        : undefined,
    stones: normalized.stones?.trim() || undefined,
    weightGrams: normalized.weightGrams,
    priceMayoreo: normalized.priceMayoreo,
    priceMenudeo: normalized.priceMenudeo,
    inventoryMode: normalized.inventoryMode,
    stock: normalized.stock,
    status: normalized.status ?? "disponible",
    image: normalized.image?.trim() || DEFAULT_IMAGE,
    notes: normalized.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function clampCartToProducts(list: Product[], prev: CartLine[]): CartLine[] {
  const next: CartLine[] = [];
  for (const line of prev) {
    const fresh = list.find((p) => p.id === line.product.id);
    if (!fresh) continue;
    const block = posProductBlockReason(fresh);
    if (block) continue;
    const qty = Math.min(line.qty, fresh.stock);
    if (qty <= 0) continue;
    next.push({ product: fresh, qty });
  }
  if (
    next.length === prev.length &&
    next.every(
      (l, i) =>
        l.product.id === prev[i]!.product.id &&
        l.qty === prev[i]!.qty &&
        l.product.stock === prev[i]!.product.stock
    )
  ) {
    return prev;
  }
  return next;
}

export function PosProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [inventorySource, setInventorySource] =
    useState<InventorySource>("loading");
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [useMongo, setUseMongo] = useState(false);

  const refreshInventory = useCallback(async () => {
    setInventoryError(null);
    const mongoUp = await isMongoApiAvailable();
    if (mongoUp) {
      try {
        const [list, salesList, clientList, orderList] = await Promise.all([
          productsApi.list(),
          salesApi.list(),
          clientsApi.list(),
          ordersApi.list(),
        ]);
        setProducts(list);
        setSales(salesList);
        setClients(clientList);
        setOrders(orderList);
        setUseMongo(true);
        setInventorySource("mongo");
        return;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar inventario desde MongoDB.";
        setInventoryError(msg);
      }
    }

    setUseMongo(false);
    setInventorySource("local");
    setProducts(loadLocalProducts());
    setSales(loadLocalSales());
    setClients([]);
    setOrders([]);
    if (!mongoUp) {
      setInventoryError(
        "API no disponible. Usando inventario local del navegador."
      );
    }
  }, []);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    setCart((prev) => clampCartToProducts(products, prev));
  }, [products]);

  useEffect(() => {
    if (inventorySource !== "local") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products, inventorySource]);

  useEffect(() => {
    if (inventorySource !== "local") return;
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(sales));
  }, [sales, inventorySource]);

  const createProduct = useCallback(
    async (input: ProductInput): Promise<Product> => {
      const payload = applyInventoryModeRules(input);
      if (useMongo) {
        const created = await productsApi.create(payload);
        setProducts((prev) => [created, ...prev]);
        return created;
      }
      let created!: Product;
      setProducts((prev) => {
        created = buildLocalProduct(payload, prev);
        return [created, ...prev];
      });
      return created;
    },
    [useMongo]
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<ProductInput>) => {
      if (useMongo) {
        const updated = await productsApi.update(id, patch);
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? updated : p))
        );
        setCart((prev) =>
          prev.map((l) =>
            l.product.id === id ? { ...l, product: updated } : l
          )
        );
        return;
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            name: patch.name?.trim() ?? p.name,
            category: patch.category ?? p.category,
            metal: patch.metal !== undefined ? patch.metal : p.metal,
            metalOther:
              patch.metal !== undefined
                ? patch.metal === "otro"
                  ? patch.metalOther?.trim() || undefined
                  : undefined
                : patch.metalOther !== undefined
                  ? patch.metalOther.trim() || undefined
                  : p.metalOther,
            stones:
              patch.stones !== undefined
                ? patch.stones.trim() || undefined
                : p.stones,
            weightGrams:
              patch.weightGrams !== undefined
                ? patch.weightGrams
                : p.weightGrams,
            priceMayoreo:
              patch.priceMayoreo !== undefined
                ? patch.priceMayoreo
                : p.priceMayoreo,
            priceMenudeo:
              patch.priceMenudeo !== undefined
                ? patch.priceMenudeo
                : p.priceMenudeo,
            inventoryMode:
              patch.inventoryMode !== undefined
                ? patch.inventoryMode
                : p.inventoryMode,
            stock:
              patch.stock !== undefined
                ? Math.max(0, Math.floor(patch.stock))
                : p.stock,
            status: patch.status ?? p.status,
            image: patch.image?.trim() || p.image,
            notes:
              patch.notes !== undefined
                ? patch.notes.trim() || undefined
                : p.notes,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [useMongo]
  );

  const adjustStock = useCallback(
    async (id: string, delta: number) => {
      if (useMongo) {
        const updated = await productsApi.adjustStock(id, delta);
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? updated : p))
        );
        setCart((prev) =>
          prev.map((l) =>
            l.product.id === id
              ? {
                  ...l,
                  product: updated,
                  qty: Math.min(l.qty, updated.stock),
                }
              : l
          )
        );
        return;
      }

      setProducts((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p;
          const stock = Math.max(0, p.stock + delta);
          let status = p.status;
          if (stock === 0 && status === "disponible") status = "vendido";
          else if (stock > 0 && status === "vendido") status = "disponible";
          return {
            ...p,
            stock,
            status,
            updatedAt: new Date().toISOString(),
          };
        });
        const updated = next.find((p) => p.id === id);
        if (updated) {
          setCart((cartPrev) =>
            cartPrev.map((l) =>
              l.product.id === id
                ? {
                    ...l,
                    product: updated,
                    qty: Math.min(l.qty, updated.stock),
                  }
                : l
            )
          );
        }
        return next;
      });
    },
    [useMongo]
  );

  const removeProduct = useCallback(
    async (id: string) => {
      if (useMongo) {
        await productsApi.remove(id);
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setCart((prev) => prev.filter((l) => l.product.id !== id));
    },
    [useMongo]
  );

  const addToCart = useCallback((product: Product, qty = 1) => {
    setCart((prev) => {
      const fresh =
        productsRef.current.find((p) => p.id === product.id) ?? product;
      if (posProductBlockReason(fresh)) return prev;

      const i = prev.findIndex((l) => l.product.id === fresh.id);
      if (i === -1) {
        const add = Math.min(qty, fresh.stock);
        if (add <= 0) return prev;
        return [...prev, { product: fresh, qty: add }];
      }
      const next = [...prev];
      const line = next[i]!;
      const nextQty = line.qty + qty;
      if (nextQty <= 0) return prev.filter((_, j) => j !== i);
      next[i] = {
        product: fresh,
        qty: Math.min(nextQty, fresh.stock),
      };
      return next;
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.product.id === productId);
      if (!line) return prev;
      if (qty <= 0) return prev.filter((l) => l.product.id !== productId);
      const fresh =
        productsRef.current.find((p) => p.id === productId) ?? line.product;
      if (posProductBlockReason(fresh)) {
        return prev.filter((l) => l.product.id !== productId);
      }
      return prev.map((l) =>
        l.product.id === productId
          ? { product: fresh, qty: Math.min(qty, fresh.stock) }
          : l
      );
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const requireMongo = useCallback(() => {
    if (!useMongo) {
      throw new Error("Clientes y pedidos requieren conexión con MongoDB.");
    }
  }, [useMongo]);

  const createClient = useCallback(
    async (input: ClientInput): Promise<Client> => {
      requireMongo();
      const created = await clientsApi.create(input);
      setClients((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
      return created;
    },
    [requireMongo]
  );

  const updateClient = useCallback(
    async (id: string, patch: Partial<ClientInput>) => {
      requireMongo();
      const updated = await clientsApi.update(id, patch);
      setClients((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
    },
    [requireMongo]
  );

  const removeClient = useCallback(
    async (id: string) => {
      requireMongo();
      await clientsApi.remove(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    },
    [requireMongo]
  );

  const refreshProductsQuiet = useCallback(async () => {
    if (!useMongo) return;
    const list = await productsApi.list();
    setProducts(list);
    setCart((prev) => clampCartToProducts(list, prev));
  }, [useMongo]);

  const refreshSalesQuiet = useCallback(async () => {
    if (!useMongo) return;
    const salesList = await salesApi.list();
    setSales(salesList);
  }, [useMongo]);

  const createOrder = useCallback(
    async (input: OrderInput): Promise<OrderRecord> => {
      requireMongo();
      const created = await ordersApi.create(input);
      setOrders((prev) => [created, ...prev]);
      if (input.items.some((i) => i.productId)) {
        await refreshProductsQuiet();
      }
      return created;
    },
    [requireMongo, refreshProductsQuiet]
  );

  const updateOrder = useCallback(
    async (id: string, patch: Parameters<typeof ordersApi.update>[1]) => {
      requireMongo();
      const updated = await ordersApi.update(id, patch);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? updated : o))
      );
      const touchesInventory =
        patch.status === "cancelado" ||
        patch.status === "entregado" ||
        patch.items !== undefined;
      if (touchesInventory) {
        await refreshProductsQuiet();
      }
      if (patch.status === "entregado") {
        const salesList = await salesApi.list();
        setSales(salesList);
      }
      return updated;
    },
    [requireMongo, refreshProductsQuiet]
  );

  const addOrderDeposit = useCallback(
    async (id: string, amount: number) => {
      requireMongo();
      const updated = await ordersApi.addDeposit(id, amount);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? updated : o))
      );
      return updated;
    },
    [requireMongo]
  );

  const checkout = useCallback(
    async (
      payment: SaleRecord["payment"],
      paymentMix?: PaymentMix
    ): Promise<SaleRecord> => {
      const current = cart;
      if (current.length === 0) {
        throw new Error("El ticket está vacío.");
      }

      const tier = priceTierForCart(current);
      const total = cartTotal(current);
      let mix: PaymentMix | undefined;
      if (payment === "mixto") {
        const err = validatePaymentMix(paymentMix ?? {}, total);
        if (err) throw new Error(err);
        mix = normalizePaymentMix(paymentMix ?? {});
      }

      if (useMongo) {
        for (const line of current) {
          const fresh =
            productsRef.current.find((p) => p.id === line.product.id) ??
            line.product;
          const block = posProductBlockReason(fresh);
          if (block) throw new Error(block);
          if (line.qty > fresh.stock) {
            throw new Error(
              `${fresh.name}: solo hay ${fresh.stock} disponible(s) en mostrador.`
            );
          }
        }
        const sale = await salesApi.checkout({
          payment,
          paymentMix: mix,
          items: current.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            unitPrice: productPrice(l.product, tier),
          })),
        });
        const list = await productsApi.list();
        setProducts(list);
        setSales((s) => [sale, ...s]);
        setCart([]);
        return sale;
      }

      const sale: SaleRecord = {
        id: uid(),
        at: new Date().toISOString(),
        total,
        items: current.map((l) => ({
          name: l.product.name,
          sku: l.product.sku,
          qty: l.qty,
          unitPrice: productPrice(l.product, tier),
          metal: l.product.metal,
          metalOther: l.product.metalOther,
          unitCost: l.product.priceMayoreo,
        })),
        payment,
        paymentMix: mix,
        seller: "Mostrador",
      };

      for (const line of current) {
        const block = posProductBlockReason(line.product);
        if (block) throw new Error(block);
        if (line.qty > line.product.stock) {
          throw new Error(
            `${line.product.name}: solo hay ${line.product.stock} disponible(s).`
          );
        }
      }
      setProducts((prods) =>
        prods.map((p) => {
          const line = current.find((l) => l.product.id === p.id);
          if (!line) return p;
          return {
            ...p,
            stock: Math.max(0, p.stock - line.qty),
            updatedAt: new Date().toISOString(),
          };
        })
      );
      setSales((s) => [sale, ...s]);
      setCart([]);
      return sale;
    },
    [cart, useMongo]
  );

  const value = useMemo(
    () => ({
      products,
      cart,
      sales,
      clients,
      orders,
      inventorySource,
      inventoryError,
      refreshInventory,
      refreshProductsQuiet,
      refreshSalesQuiet,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      checkout,
      createProduct,
      updateProduct,
      adjustStock,
      removeProduct,
      setProducts,
      createClient,
      updateClient,
      removeClient,
      createOrder,
      updateOrder,
      addOrderDeposit,
    }),
    [
      products,
      cart,
      sales,
      clients,
      orders,
      inventorySource,
      inventoryError,
      refreshInventory,
      refreshProductsQuiet,
      refreshSalesQuiet,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      checkout,
      createProduct,
      updateProduct,
      adjustStock,
      removeProduct,
      createClient,
      updateClient,
      removeClient,
      createOrder,
      updateOrder,
      addOrderDeposit,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosState {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos debe usarse dentro de PosProvider");
  return ctx;
}
