const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;

const QUIZ_CHANNEL_ID = "1510609642190016582";
const ADMIN_ID = "1004034354919506011";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATABASE ================= */

const FILE = "/data/quiz_data.json";

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({}));
}

let data = JSON.parse(fs.readFileSync(FILE));

if (!data.players) data.players = {};
if (!data.config) data.config = {};
if (!data.config.lastQuizDate) data.config.lastQuizDate = "";
if (!data.config.currentQuestionId) data.config.currentQuestionId = null;
if (!data.config.answeredUsers) data.config.answeredUsers = [];
if (!data.config.correctUsers) data.config.correctUsers = [];
if (!data.config.quizMessageId) data.config.quizMessageId = null;
if (!data.config.rankingMessageId) data.config.rankingMessageId = null;

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* ================= TIME ================= */

function getJakarta() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Jakarta"
    })
  );
}

function getToday() {
  const now = getJakarta();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/* ================= QUESTIONS ================= */

const questions = [
  {
    question: "Siapa pencipta Roblox?",
    options: [
      "A. Elon Musk",
      "B. David Baszucki",
      "C. Gabe Newell",
      "D. Markus Persson",
      "E. Bill Gates"
    ],
    answer: "B"
  },

  {
    question: "Planet terbesar di tata surya?",
    options: [
      "A. Mars",
      "B. Saturnus",
      "C. Jupiter",
      "D. Venus",
      "E. Bumi"
    ],
    answer: "C"
  },

  {
    question: "Berapa hasil 10 x 10?",
    options: [
      "A. 10",
      "B. 50",
      "C. 80",
      "D. 100",
      "E. 120"
    ],
    answer: "D"
  },

  {
    question: "Game buatan Mojang?",
    options: [
      "A. Roblox",
      "B. Valorant",
      "C. Minecraft",
      "D. PUBG",
      "E. Free Fire"
    ],
    answer: "C"
  }
];

/* ================= PLAYER ================= */

function getPlayer(id) {
  if (!data.players[id]) {
    data.players[id] = {
      points: 0
    };
  }

  return data.players[id];
}

/* ================= RANKING ================= */

async function updateRanking() {

  const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);

  const players = Object.entries(data.players)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);

  let text = "Belum ada ranking";

  if (players.length > 0) {
    text = players.map((p, i) => {
      const medal =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" :
        `${i + 1}.`;

      return `${medal} <@${p[0]}> — ${p[1].points} poin`;
    }).join("\n");
  }

  const topUser = players[0];

  let thumbnail = null;

  if (topUser) {
    const user = await client.users.fetch(topUser[0]);
    thumbnail = user.displayAvatarURL();
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 MONTHLY QUIZ RANKING")
    .setDescription(`
🎁 Juara 1 akhir bulan mendapatkan **100 ROBUX**

━━━━━━━━━━━━━━━━━━

${text}

━━━━━━━━━━━━━━━━━━

🕖 Quiz muncul:
• 19:00 WIB
• 20:00 WIB
• 21:00 WIB
• 22:00 WIB

⚡ Jawaban pertama benar = +2 poin
✅ Jawaban benar biasa = +1 poin
❌ Kesempatan jawab hanya 1x
`)
    .setColor("Gold");

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  try {

    if (data.config.rankingMessageId) {

      const msg = await channel.messages.fetch(data.config.rankingMessageId);

      await msg.edit({
        embeds: [embed]
      });

    } else {

      const sent = await channel.send({
        embeds: [embed]
      });

      data.config.rankingMessageId = sent.id;
      save();
    }

  } catch {

    const sent = await channel.send({
      embeds: [embed]
    });

    data.config.rankingMessageId = sent.id;
    save();
  }
}

/* ================= SEND QUIZ ================= */

async function sendQuiz() {

  const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);

  const qid = Math.floor(Math.random() * questions.length);
  const q = questions[qid];

  data.config.currentQuestionId = qid;
  data.config.answeredUsers = [];
  data.config.correctUsers = [];

  save();

  try {

    if (data.config.quizMessageId) {

      const oldMsg = await channel.messages.fetch(data.config.quizMessageId);

      await oldMsg.delete().catch(() => {});
    }

  } catch {}

  const embed = new EmbedBuilder()
    .setTitle("🎯 QUIZ TIME")
    .setDescription(`
## ${q.question}

${q.options.join("\n")}

━━━━━━━━━━━━━━━━━━

📌 Jawab:
A / B / C / D / E

⚠️ Kesempatan jawab hanya 1x
`)
    .setColor("Blue");

  const sent = await channel.send({
    embeds: [embed]
  });

  data.config.quizMessageId = sent.id;

  save();

  updateRanking();
}

/* ================= ANSWER ================= */

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (msg.channel.id !== QUIZ_CHANNEL_ID) return;

  const answer = msg.content.toUpperCase();

  if (!["A", "B", "C", "D", "E"].includes(answer)) return;

  if (data.config.currentQuestionId === null) return;

  if (data.config.answeredUsers.includes(msg.author.id)) {
    return msg.reply("❌ Kamu sudah menjawab.");
  }

  data.config.answeredUsers.push(msg.author.id);

  const q = questions[data.config.currentQuestionId];

  if (answer === q.answer) {

    const player = getPlayer(msg.author.id);

    let point = 1;

    if (data.config.correctUsers.length === 0) {
      point = 2;
    }

    player.points += point;

    data.config.correctUsers.push(msg.author.id);

    save();

    await msg.reply(`✅ Jawaban benar! +${point} poin`);

  } else {

    await msg.reply(`❌ Jawaban salah`);
  }

  updateRanking();
});

/* ================= SPAM EVENT ================= */

let spamGame = {
  active: false,
  word: "",
  counts: {}
};

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (msg.channel.id !== QUIZ_CHANNEL_ID) return;

  /* ===== ADMIN START ===== */

  if (
    msg.author.id === ADMIN_ID &&
    msg.content.startsWith("!mulai ")
  ) {

    if (spamGame.active) {
      return msg.reply("❌ Masih ada event berjalan.");
    }

    const word = msg.content
      .replace("!mulai ", "")
      .trim()
      .toLowerCase();

    if (!word) return;

    spamGame.active = true;
    spamGame.word = word;
    spamGame.counts = {};

    await msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎯 WORD SPAM EVENT")
          .setDescription(`
📝 Kata:

## ${word.toUpperCase()}

━━━━━━━━━━━━━━━━━━

⏳ Durasi: 5 Menit

🏆 Yang paling banyak mengetik kata ini menang

⭐ Hadiah:
+1 Poin Ranking
`)
          .setColor("Green")
      ]
    });

    setTimeout(async () => {

      if (!spamGame.active) return;

      const sorted = Object.entries(spamGame.counts)
        .sort((a, b) => b[1] - a[1]);

      if (sorted.length === 0) {

        spamGame.active = false;

        return msg.channel.send(
          "❌ Event selesai. Tidak ada peserta."
        );
      }

      const winnerId = sorted[0][0];
      const winnerCount = sorted[0][1];

      const player = getPlayer(winnerId);

      player.points += 1;

      save();

      const result = sorted
        .slice(0, 10)
        .map((u, i) => {

          const medal =
            i === 0 ? "🥇" :
            i === 1 ? "🥈" :
            i === 2 ? "🥉" :
            `${i + 1}.`;

          return `${medal} <@${u[0]}> — ${u[1]}x`;
        })
        .join("\n");

      await msg.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎉 WORD SPAM SELESAI")
            .setDescription(`
📝 Kata:
**${spamGame.word.toUpperCase()}**

━━━━━━━━━━━━━━━━━━

${result}

━━━━━━━━━━━━━━━━━━

🏆 Pemenang:
<@${winnerId}>

⭐ +1 Poin Ranking
`)
            .setColor("Gold")
        ]
      });

      spamGame.active = false;
      spamGame.word = "";
      spamGame.counts = {};

      updateRanking();

    }, 300000);

    return;
  }

  /* ===== ADMIN STOP ===== */

  if (
    msg.author.id === ADMIN_ID &&
    msg.content === "!akhir"
  ) {

    spamGame.active = false;
    spamGame.word = "";
    spamGame.counts = {};

    return msg.reply("✅ Event dihentikan.");
  }

  /* ===== HITUNG SPAM ===== */

  if (!spamGame.active) return;

  if (
    msg.content.trim().toLowerCase() ===
    spamGame.word
  ) {

    if (!spamGame.counts[msg.author.id]) {
      spamGame.counts[msg.author.id] = 0;
    }

    spamGame.counts[msg.author.id]++;
  }

});

/* ================= AUTO QUIZ ================= */

setInterval(async () => {

  const now = getJakarta();

  const hour = now.getHours();
  const minute = now.getMinutes();

  const validHours = [19, 20, 21, 22];

  if (
    validHours.includes(hour) &&
    minute === 0
  ) {

    const key = `${getToday()}-${hour}`;

    if (data.config.lastQuizDate !== key) {

      data.config.lastQuizDate = key;

      save();

      sendQuiz();
    }
  }

}, 15000);

/* ================= MONTH END ================= */

setInterval(async () => {

  const now = getJakarta();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (tomorrow.getMonth() !== now.getMonth()) {

    if (now.getHours() === 23 && now.getMinutes() === 59) {

      const players = Object.entries(data.players)
        .sort((a, b) => b[1].points - a[1].points);

      if (players.length > 0) {

        const winner = players[0];

        const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);

        await channel.send(`
🏆 QUIZ BULANAN SELESAI

🥇 Pemenang:
<@${winner[0]}>

🎁 Hadiah:
100 ROBUX
`);
      }

      data.players = {};
      save();

      updateRanking();
    }
  }

}, 30000);

/* ================= READY ================= */

client.once("ready", async () => {

  console.log("QUIZ BOT ONLINE 🔥");

  updateRanking();
});

client.login(TOKEN);