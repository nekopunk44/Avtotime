import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/messages.model.js";

const app = createApp();

const signUp = async (userName, email) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: userName,
    userName,
    email,
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

const send = (from, toId, text) =>
  request(app)
    .post(`/api/message/send/${toId}`)
    .set("Authorization", `Bearer ${from.token}`)
    .send({ message: text });

let alice;
let bob;

beforeEach(async () => {
  alice = await signUp("alice", "alice@example.com");
  bob = await signUp("bob", "bob@example.com");
});

describe("хранение переписки", () => {
  it("документ диалога не растёт с каждым сообщением", async () => {
    for (let i = 0; i < 5; i += 1) {
      const r = await send(alice, bob.id, `msg ${i}`);
      if (r.status !== 200) console.log("SEND FAIL:", JSON.stringify(r.body));
      expect(r.status).toBe(200);
    }

    // Регрессия 16 МБ: раньше каждый send делал $push в messages, и диалог
    // рос до жёсткого лимита документа, после которого запись ломалась.
    const conversation = await Conversation.findOne().lean();
    expect(conversation.messages ?? []).toHaveLength(0);
    expect(await Message.countDocuments()).toBe(5);
    expect(conversation.lastMessageAt).toBeTruthy();
  });

  it("история читается по паре и корректно пагинируется", async () => {
    for (let i = 1; i <= 7; i += 1) {
      await send(i % 2 ? alice : bob, i % 2 ? bob.id : alice.id, `msg ${i}`);
    }

    const page1 = await request(app)
      .get(`/api/message/getAll/${bob.id}?page=1&limit=3`)
      .set("Authorization", `Bearer ${alice.token}`);
    const page2 = await request(app)
      .get(`/api/message/getAll/${bob.id}?page=2&limit=3`)
      .set("Authorization", `Bearer ${alice.token}`);

    expect(page1.status).toBe(200);
    // Первая страница — самые свежие, внутри по возрастанию (как рисует чат).
    expect(page1.body.map((m) => m.message)).toEqual(["msg 5", "msg 6", "msg 7"]);
    expect(page2.body.map((m) => m.message)).toEqual(["msg 2", "msg 3", "msg 4"]);
  });

  it("список чатов показывает последнее сообщение и непрочитанные", async () => {
    await send(alice, bob.id, "привет");
    await send(alice, bob.id, "ты тут?");

    const chats = await request(app)
      .get("/api/message/prevChats")
      .set("Authorization", `Bearer ${bob.token}`);

    expect(chats.status).toBe(200);
    expect(chats.body).toHaveLength(1);
    expect(chats.body[0].userName).toBe("alice");
    expect(chats.body[0].lastMessage).toBe("ты тут?");
    expect(chats.body[0].unreadCount).toBe(2);
  });

  it("открытие чата гасит непрочитанные", async () => {
    await send(alice, bob.id, "привет");

    await request(app)
      .get(`/api/message/getAll/${alice.id}`)
      .set("Authorization", `Bearer ${bob.token}`);

    const chats = await request(app)
      .get("/api/message/prevChats")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(chats.body[0].unreadCount).toBe(0);
  });

  it("удаление переписки удаляет сообщения по паре, включая унаследованные", async () => {
    await send(alice, bob.id, "раз");
    await send(bob, alice.id, "два");
    // Сообщение без записи в каком-либо массиве — как в старых данных.
    await Message.create({ sender: alice.id, receiver: bob.id, message: "сирота" });

    const response = await request(app)
      .delete(`/api/message/conversation/${bob.id}`)
      .set("Authorization", `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(await Message.countDocuments()).toBe(0);
    expect(await Conversation.countDocuments()).toBe(0);
  });

  it("заблокировавшему нельзя написать", async () => {
    await request(app)
      .post(`/api/message/block/${alice.id}`)
      .set("Authorization", `Bearer ${bob.token}`);

    const response = await send(alice, bob.id, "пусти");

    expect(response.status).toBe(403);
    expect(await Message.countDocuments()).toBe(0);
  });
});

describe("миграция старых диалогов", () => {
  it("legacy-диалог с массивом messages показывается в списке через фолбэк", async () => {
    const m1 = await Message.create({ sender: alice.id, receiver: bob.id, message: "старое" });
    const m2 = await Message.create({ sender: alice.id, receiver: bob.id, message: "новее" });
    await Conversation.create({
      participants: [alice.id, bob.id],
      messages: [m1._id, m2._id],
      // Ни lastMessageAt, ни preview — как у диалогов до денормализации.
    });

    const chats = await request(app)
      .get("/api/message/prevChats")
      .set("Authorization", `Bearer ${bob.token}`);

    expect(chats.status).toBe(200);
    expect(chats.body[0].lastMessage).toBe("новее");
  });
});
