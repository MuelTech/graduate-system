import { vi } from "vitest";

export function administrator(id: string, level: string | null = "FULL", changes: Record<string, any> = {}) {
  return { id, email: `${id}@example.test`, firstName: "Synthetic", lastName: "Administrator", role: "ADMIN",
    isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: level ? { level } : null, capabilityGrants: [], passwordHash: "preserved-existing-hash", ...changes };
}
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

/** Transactional test double: drafts start AFTER the fence, commit atomically, discard on failure.
 * This models transaction ordering/rollback; it does not prove InnoDB locking behavior. */
export function administratorDatabase() {
  let store = { users: [administrator("full-a"), administrator("full-b"), administrator("restricted", "RESTRICTED")], audits: [] as any[] };
  let tail = Promise.resolve(); let sequence = 0;
  let nextFence: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  const control = { failAudit: false, failAuditAt: 0, missingFence: false, trace: [] as string[],
    get state() { return store; },
    holdNextFence() { nextFence = { entered: deferred(), release: deferred() }; return nextFence; },
  };
  const database = {
    user: { findUnique: vi.fn(async ({ where }: any) => store.users.find(user => user.id === where.id) ?? null) },
    $transaction: vi.fn(async (operation: (tx: any) => Promise<any>, options: unknown) => {
      let draft: typeof store | undefined; let unlock: (() => void) | undefined;
      const state = () => { if (!draft) throw new Error("Account read/write before fence"); return draft; };
      const user = (id: string) => { const found = state().users.find(row => row.id === id); if (!found) throw new Error("Missing user"); return found; };
      const tx = {
        $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
          const sql = strings.join("?"); control.trace.push(sql);
          if (sql.includes("administrator_access_lock")) {
            const previous = tail; const released = deferred(); tail = previous.then(() => released.promise);
            unlock = released.resolve; await previous;
            const held = nextFence; nextFence = undefined;
            draft = structuredClone(store);
            if (held) { held.entered.resolve(); await held.release.promise; }
            return control.missingFence ? [] : [{ id: 1 }];
          }
          state(); return [];
        }),
        user: {
          findUnique: vi.fn(async ({ where }: any) => { control.trace.push(`read:${where.id}`); return state().users.find(row => row.id === where.id) ?? null; }),
          findMany: vi.fn(async ({ where, skip = 0, take = 1000 }: any) => state().users.filter(row => row.role === where.role &&
            (where.isActive === undefined || row.isActive === where.isActive) &&
            (!where.administratorAccess || row.administratorAccess?.level === where.administratorAccess.is.level)).slice(skip, skip + take)),
          create: vi.fn(async ({ data }: any) => {
            if (state().users.some(row => row.email === data.email)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
            const created = administrator(`new-${++sequence}`, null, data); state().users.push(created); return { id: created.id };
          }),
          update: vi.fn(async ({ where, data }: any) => Object.assign(user(where.id), data)),
        },
        administratorAccess: {
          create: vi.fn(async ({ data }: any) => { user(data.userId).administratorAccess = { level: data.level }; return data; }),
          update: vi.fn(async ({ where, data }: any) => { user(where.userId).administratorAccess = { level: data.level }; return data; }),
          delete: vi.fn(async ({ where }: any) => { user(where.userId).administratorAccess = null; }),
        },
        accountCapabilityGrant: {
          createMany: vi.fn(async ({ data }: any) => { for (const row of data) user(row.userId).capabilityGrants.push({ capabilityKey: row.capabilityKey }); return { count: data.length }; }),
          deleteMany: vi.fn(async ({ where }: any) => { const target = user(where.userId); const before = target.capabilityGrants.length;
            target.capabilityGrants = target.capabilityGrants.filter((row: any) => where.capabilityKey && !where.capabilityKey.in.includes(row.capabilityKey));
            return { count: before - target.capabilityGrants.length }; }),
        },
        auditLog: { create: vi.fn(async ({ data }: any) => {
          if (control.failAudit || (control.failAuditAt > 0 && state().audits.length + 1 === control.failAuditAt)) throw new Error("Synthetic audit failure");
          state().audits.push(data); return data;
        }) },
      };
      try { const result = await operation(tx); store = state(); return result; }
      finally { unlock?.(); }
    }),
  };
  return { database, control };
}
