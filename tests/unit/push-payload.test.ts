import { describe, expect, it } from "vitest";
import { pushPayloadFromNotification } from "@/lib/notifications/push-payload";

describe("pushPayloadFromNotification", () => {
  it("passa titolo, corpo, data e usa l'id come tag", () => {
    const data = { type: "lobby_starting_soon", lobby_id: "l1" };
    expect(
      pushPayloadFromNotification({
        id: "notif-1",
        title: "La lobby sta per iniziare!",
        body: "La lobby al campo X inizia tra 15 minuti.",
        data,
      }),
    ).toEqual({
      title: "La lobby sta per iniziare!",
      body: "La lobby al campo X inizia tra 15 minuti.",
      data,
      tag: "notif-1",
    });
  });

  it("fallback sobri per titolo/corpo vuoti", () => {
    expect(
      pushPayloadFromNotification({
        id: "notif-2",
        title: "  ",
        body: "",
        data: {},
      }),
    ).toEqual({
      title: "Drop-In",
      body: "Hai un nuovo avviso.",
      data: {},
      tag: "notif-2",
    });
  });

  it("data non oggetto -> oggetto vuoto, senza eccezioni", () => {
    expect(
      pushPayloadFromNotification({
        id: "notif-3",
        title: "T",
        body: "B",
        data: "malformato",
      }),
    ).toEqual({ title: "T", body: "B", data: {}, tag: "notif-3" });
    expect(
      pushPayloadFromNotification({
        id: "notif-4",
        title: "T",
        body: "B",
        data: ["un", "array"],
      }),
    ).toEqual({ title: "T", body: "B", data: {}, tag: "notif-4" });
  });
});
