import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";
import { initKarmaSubscription } from "@/components/notifications/karma-subscription";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// Client fake con getUser() a risoluzione controllata (deferred): simula il
// gap async in cui l'unmount/StrictMode-remount può avvenire prima che il
// channel esista.
function makeClient() {
  type GetUserResult = Awaited<
    ReturnType<SupabaseClient<Database>["auth"]["getUser"]>
  >;
  let resolveUser!: (value: GetUserResult) => void;
  const userPromise = new Promise<GetUserResult>((resolve) => {
    resolveUser = resolve;
  });

  type Handler = (payload: { old: object; new: object }) => void;
  let capturedHandler: Handler | null = null;
  const channelStub = {
    on: vi.fn((_type: string, _filter: object, handler: Handler) => {
      capturedHandler = handler;
      return channelStub;
    }),
    subscribe: vi.fn(() => channelStub),
  };
  const client = {
    auth: { getUser: vi.fn(() => userPromise) },
    channel: vi.fn(() => channelStub),
    removeChannel: vi.fn(),
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    resolveUser,
    channelStub,
    getHandler: () => capturedHandler,
  };
}

const USER = { id: "user-1" };

function resolveAsUser(
  resolveUser: (
    v: Awaited<ReturnType<SupabaseClient<Database>["auth"]["getUser"]>>
  ) => void
) {
  // Al fake basta `data`: il resto del tipo reale non serve al test.
  const payload = { data: { user: USER } } as unknown as Awaited<
    ReturnType<SupabaseClient<Database>["auth"]["getUser"]>
  >;
  resolveUser(payload);
}

async function flush() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("initKarmaSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cleanup prima che getUser risolva → nessun channel orfano", async () => {
    const { client, resolveUser, channelStub } = makeClient();

    const cleanup = initKarmaSubscription(client);
    cleanup();
    resolveAsUser(resolveUser);
    await flush();

    expect(client.channel).not.toHaveBeenCalled();
    expect(channelStub.subscribe).not.toHaveBeenCalled();
  });

  it("flusso normale: apre un channel sul topic utente e notifica il calo", async () => {
    const { client, resolveUser, getHandler } = makeClient();

    const cleanup = initKarmaSubscription(client);
    resolveAsUser(resolveUser);
    await flush();

    expect(client.channel).toHaveBeenCalledWith("profile-toast-user-1");
    const handler = getHandler();
    expect(handler).not.toBeNull();

    handler!({
      old: { karma_score: 90, banned_until: null },
      new: { karma_score: 87, banned_until: null },
    });
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("87"),
      expect.objectContaining({ id: "karma-87" })
    );

    cleanup();
  });

  it("stesso payload due volte → stesso id (Sonner sostituisce, non accoda)", async () => {
    const { client, resolveUser, getHandler } = makeClient();

    initKarmaSubscription(client);
    resolveAsUser(resolveUser);
    await flush();

    const payload = {
      old: { karma_score: 90, banned_until: null },
      new: { karma_score: 87, banned_until: null },
    };
    getHandler()!(payload);
    getHandler()!(payload);

    const calls = vi.mocked(toast.warning).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toEqual(calls[1][1]);
    expect(calls[0][1]).toMatchObject({ id: "karma-87" });
  });

  it("cleanup dopo subscribe → removeChannel sul channel aperto", async () => {
    const { client, resolveUser, channelStub } = makeClient();

    const cleanup = initKarmaSubscription(client);
    resolveAsUser(resolveUser);
    await flush();

    cleanup();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
    expect(client.removeChannel).toHaveBeenCalledWith(channelStub);
  });

  it("utente non loggato → nessun channel", async () => {
    const { client, resolveUser } = makeClient();

    initKarmaSubscription(client);
    const nullPayload = { data: { user: null } } as unknown as Awaited<
      ReturnType<SupabaseClient<Database>["auth"]["getUser"]>
    >;
    resolveUser(nullPayload);
    await flush();

    expect(client.channel).not.toHaveBeenCalled();
  });
});
