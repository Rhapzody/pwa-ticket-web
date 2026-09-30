import type { CacheMetadata, CachedOrder, CachedProfile, CachedTicket } from "@/lib/types";

type Entity = CachedProfile | CachedOrder | CachedTicket | CacheMetadata;
type StoreName = "profiles" | "orders" | "tickets" | "metadata";
type IndexMatch<T> = {
  toArray(): Promise<T[]>;
  count(): Promise<number>;
  delete(): Promise<number>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("offline-ticket-poc", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("profiles", { keyPath: "id" });
      const orders = db.createObjectStore("orders", { keyPath: "id" });
      orders.createIndex("userId", "userId", { unique: false });
      orders.createIndex("createdAt", "createdAt", { unique: false });
      const tickets = db.createObjectStore("tickets", { keyPath: "id" });
      tickets.createIndex("userId", "userId", { unique: false });
      tickets.createIndex("orderId", "orderId", { unique: false });
      tickets.createIndex("issuedAt", "issuedAt", { unique: false });
      db.createObjectStore("metadata", { keyPath: "key" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another open tab."));
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function getNativeDatabase() {
  databasePromise ??= openDatabase();
  return databasePromise;
}

function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  enqueue: (store: IDBObjectStore, setResult: (result: T) => void) => void,
): Promise<T> {
  return getNativeDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        let result: T;
        enqueue(transaction.objectStore(storeName), (value) => {
          result = value;
        });
        transaction.oncomplete = () => resolve(result!);
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
      }),
  );
}

function transactStores(storeNames: StoreName[], enqueue: (transaction: IDBTransaction) => void): Promise<void> {
  return getNativeDatabase().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeNames, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
        try {
          enqueue(transaction);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      }),
  );
}

function replaceOwnedRows<T extends CachedOrder | CachedTicket>(
  store: IDBObjectStore,
  userId: string,
  rows: T[],
) {
  const request = store.index("userId").openCursor(userId);
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      rows.forEach((row) => store.put(row));
      return;
    }
    const deletion = cursor.delete();
    deletion.onsuccess = () => cursor.continue();
  };
}

class TableStore<T extends Entity> {
  constructor(private readonly name: string) {}

  get(key: string): Promise<T | undefined> {
    return transact<T | undefined>(this.name, "readonly", (store, setResult) => {
      const request = store.get(key);
      request.onsuccess = () => setResult(request.result as T | undefined);
    });
  }

  put(value: T): Promise<string> {
    return transact<string>(this.name, "readwrite", (store, setResult) => {
      const request = store.put(value);
      request.onsuccess = () => setResult(String(request.result));
    });
  }

  bulkPut(values: T[]): Promise<string[]> {
    return transact<string[]>(this.name, "readwrite", (store, setResult) => {
      const keys: string[] = [];
      for (const value of values) {
        const request = store.put(value);
        request.onsuccess = () => keys.push(String(request.result));
      }
      setResult(keys);
    });
  }

  clear(): Promise<void> {
    return transact<void>(this.name, "readwrite", (store, setResult) => {
      const request = store.clear();
      request.onsuccess = () => setResult(undefined);
    });
  }

  where(indexName: string) {
    return {
      equals: (value: IDBValidKey): IndexMatch<T> => ({
        toArray: () =>
          transact<T[]>(this.name, "readonly", (store, setResult) => {
            const request = store.index(indexName).getAll(value);
            request.onsuccess = () => setResult(request.result as T[]);
          }),
        count: () =>
          transact<number>(this.name, "readonly", (store, setResult) => {
            const request = store.index(indexName).count(value);
            request.onsuccess = () => setResult(request.result);
          }),
        delete: () =>
          transact<number>(this.name, "readwrite", (store, setResult) => {
            const request = store.index(indexName).openCursor(value);
            let removed = 0;
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) {
                setResult(removed);
                return;
              }
              cursor.delete();
              removed += 1;
              cursor.continue();
            };
          }),
      }),
    };
  }
}

class OfflineTicketDatabase {
  readonly profiles = new TableStore<CachedProfile>("profiles");
  readonly orders = new TableStore<CachedOrder>("orders");
  readonly tickets = new TableStore<CachedTicket>("tickets");
  readonly metadata = new TableStore<CacheMetadata>("metadata");

  replaceUserSnapshot(profile: CachedProfile, orders: CachedOrder[], tickets: CachedTicket[]): Promise<void> {
    if (orders.some((order) => order.userId !== profile.id) || tickets.some((ticket) => ticket.userId !== profile.id)) {
      return Promise.reject(new Error("The snapshot contains another user's records."));
    }
    return transactStores(["profiles", "orders", "tickets", "metadata"], (transaction) => {
      transaction.objectStore("profiles").put(profile);
      replaceOwnedRows(transaction.objectStore("orders"), profile.id, orders);
      replaceOwnedRows(transaction.objectStore("tickets"), profile.id, tickets);
      transaction.objectStore("metadata").put({ key: `lastSync:${profile.id}`, value: profile.syncedAt });
    });
  }

  savePurchase(order: CachedOrder, tickets: CachedTicket[], syncedAt: string): Promise<void> {
    if (tickets.some((ticket) => ticket.userId !== order.userId || ticket.orderId !== order.id)) {
      return Promise.reject(new Error("The purchase contains tickets from another order."));
    }
    return transactStores(["orders", "tickets", "metadata"], (transaction) => {
      transaction.objectStore("orders").put(order);
      const ticketStore = transaction.objectStore("tickets");
      tickets.forEach((ticket) => ticketStore.put(ticket));
      transaction.objectStore("metadata").put({ key: `lastSync:${order.userId}`, value: syncedAt });
    });
  }

  clearAll(): Promise<void> {
    return transactStores(["profiles", "orders", "tickets", "metadata"], (transaction) => {
      for (const name of ["profiles", "orders", "tickets", "metadata"] as const) {
        transaction.objectStore(name).clear();
      }
    });
  }
}

let database: OfflineTicketDatabase | undefined;

export function getDatabase() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }

  database ??= new OfflineTicketDatabase();
  return database;
}
