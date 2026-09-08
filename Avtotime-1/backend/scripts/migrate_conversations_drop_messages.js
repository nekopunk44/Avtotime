// Разовая миграция: убирает из Conversation неограниченный массив messages.
//
// Он рос на каждой отправке и вёл диалог к жёсткому лимиту документа Mongo в
// 16 МБ. Код больше его не пишет и не читает (сообщения адресуются парой
// sender/receiver по составному индексу); здесь мы (1) добиваем
// денормализованные поля последнего сообщения у диалогов, созданных до их
// появления, и (2) выбрасываем сами массивы.
//
// Запуск внутри контейнера бэкенда (MONGODB_URL уже в окружении):
//   docker compose exec -T backend node scripts/migrate_conversations_drop_messages.js
//
// Идемпотентна: повторный запуск ничего не меняет.
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/messages.model.js";
import { encryptString } from "../services/crypto/fieldEncryption.js";

const buildPreview = (msg) =>
  msg?.message
  || (msg?.image ? "Фото" : "")
  || (msg?.file ? "Файл" : "")
  || (msg?.audioUrl ? "Голосовое сообщение" : "");

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 10_000 });

  const legacy = await Conversation.find({ lastMessageAt: { $in: [null, undefined] } })
    .select("participants")
    .lean();
  console.log(`диалогов без денормализованных полей: ${legacy.length}`);

  let backfilled = 0;
  for (const conv of legacy) {
    const [a, b] = conv.participants;
    const last = await Message.findOne({
      $or: [
        { sender: a, receiver: b },
        { sender: b, receiver: a },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!last) continue;

    await Conversation.updateOne(
      { _id: conv._id },
      {
        $set: {
          lastMessagePreview: encryptString(buildPreview(last)),
          lastMessageAt: last.createdAt,
          lastMessageSender: last.sender,
        },
      },
    );
    backfilled += 1;
  }
  console.log(`добито превью: ${backfilled}`);

  const { modifiedCount } = await Conversation.updateMany(
    { messages: { $exists: true } },
    { $unset: { messages: 1 } },
  );
  console.log(`массивы messages удалены у: ${modifiedCount}`);

  await mongoose.connection.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
