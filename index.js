const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;

const LEADERBOARD_CHANNEL_ID = "1510621642332831855";
const EVENT_CHANNEL_ID = "1510609642190016582";
const CHAT_CHANNEL_ID = "1437072659585175564";

const TARGET_WORD =
"SEMOGABULANJUNILANCAR";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATABASE ================= */

const FILE = "/data/letterhunt.json";

if (!fs.existsSync("/data")) {
  fs.mkdirSync("/data");
}

if (!fs.existsSync(FILE)) {

  fs.writeFileSync(FILE, JSON.stringify({
    players: {},
    config: {
  leaderboardMessageId: null,
  eventMessageId: null,
  trades: {}
}
  }));
}

let data = JSON.parse(
  fs.readFileSync(FILE)
);

function save() {
  fs.writeFileSync(
    FILE,
    JSON.stringify(data, null, 2)
  );
}

/* ================= TIME ================= */

function getJakarta() {

  return new Date(
    new Date().toLocaleString(
      "en-US",
      {
        timeZone: "Asia/Jakarta"
      }
    )
  );
}

function getToday() {

  const now = getJakarta();

  const y = now.getFullYear();
  const m = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const d = String(
    now.getDate()
  ).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/* ================= PLAYER ================= */

function getPlayer(id) {

  if (!data.players[id]) {

    data.players[id] = {

      tokens: 0,

      todayTokens: 0,

      chatCount: 0,

      lastTokenDate: "",

      letters: {}
    };
  }

  return data.players[id];
}

/* ================= TOKEN SYSTEM ================= */

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (msg.channel.id !== CHAT_CHANNEL_ID)
    return;

  const player = getPlayer(msg.author.id);

  const today = getToday();

  if (player.lastTokenDate !== today) {

    player.chatCount = 0;
    player.todayTokens = 0;
    player.lastTokenDate = today;
  }

  if (player.todayTokens >= 5)
    return;

  player.chatCount++;

  if (player.chatCount >= 5) {

    player.chatCount = 0;

    player.tokens++;

    player.todayTokens++;

    save();

    msg.reply(
      `🎟 Kamu mendapatkan 1 Token!\n\nToken: ${player.tokens}/5 hari ini`
    );
  }
});

/* ================= TRADE ================= */

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (
    !msg.content.startsWith("!trade")
  ) return;

  const target =
    msg.mentions.users.first();

  if (!target)
    return msg.reply(
      "Tag user dulu."
    );

  const args =
    msg.content.split(" ");

  const give =
    args[2]?.toUpperCase();

  const want =
    args[3]?.toUpperCase();

  if (!give || !want)
    return msg.reply(
      "Format salah."
    );

  const me =
    getPlayer(msg.author.id);

  if (
    !me.letters[give] ||
    me.letters[give] <= 0
  ) {

    return msg.reply(
      `Kamu tidak punya huruf ${give}`
    );
  }

  const tradeId =
    Date.now().toString();

  data.config.trades[
    tradeId
  ] = {

    from:
      msg.author.id,

    to:
      target.id,

    give,

    want
  };

  save();

  await msg.channel.send(
`🤝 Trade Offer

${msg.author}

Memberikan:
${give}

Meminta:
${want}

${target}

Ketik:

!terima ${tradeId}

untuk menerima`
  );
});

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (
    !msg.content.startsWith(
      "!terima"
    )
  ) return;

  const tradeId =
    msg.content.split(" ")[1];

  const trade =
    data.config.trades[
      tradeId
    ];

  if (!trade)
    return;

  if (
    msg.author.id !==
    trade.to
  ) {

    return msg.reply(
      "Bukan trade kamu."
    );
  }

  const sender =
    getPlayer(
      trade.from
    );

  const receiver =
    getPlayer(
      trade.to
    );

  if (
    !receiver.letters[
      trade.want
    ]
  ) {

    return msg.reply(
      `Kamu tidak punya ${trade.want}`
    );
  }

  sender.letters[
    trade.give
  ]--;

  receiver.letters[
    trade.want
  ]--;

  if (
    !sender.letters[
      trade.want
    ]
  ) {
    sender.letters[
      trade.want
    ] = 0;
  }

  if (
    !receiver.letters[
      trade.give
    ]
  ) {
    receiver.letters[
      trade.give
    ] = 0;
  }

  sender.letters[
    trade.want
  ]++;

  receiver.letters[
    trade.give
  ]++;

  delete data.config.trades[
    tradeId
  ];

  save();

  updateLeaderboard();

  msg.channel.send(
`✅ Trade berhasil

<@${trade.from}>
↔
<@${trade.to}>`
  );
});

/* ================= LETTER GACHA ================= */

const LETTER_POOL = [
  "S","E","M","O","G","A",
  "B","U","L","A","N",
  "J","U","N","I",
  "L","A","N","C","A","R"
];

function randomLetter() {

  return LETTER_POOL[
    Math.floor(
      Math.random() *
      LETTER_POOL.length
    )
  ];
}

function getLetterCount(player) {

  let total = 0;

  for (const key in player.letters) {
    total += player.letters[key];
  }

  return total;
}
        
/* ================= EVENT PANEL ================= */

async function updateEventPanel() {

  const channel =
    await client.channels.fetch(
      EVENT_CHANNEL_ID
    );

  const embed = new EmbedBuilder()
    .setTitle("🎁 MONTHLY LETTER HUNT")
    .setDescription(`
🎯 Target:

**${TARGET_WORD}**

━━━━━━━━━━━━

💬 5 Chat = 1 Token

🎟 Maks 5 Token / Hari

━━━━━━━━━━━━

🎁 Hadiah

🥇 100 Robux
🥈 75 Robux
🥉 50 Robux

━━━━━━━━━━━━

Gunakan tombol dibawah
untuk bermain.
`)
    .setColor("Gold");

  const row = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId("gacha")
        .setLabel("🎲 Gacha")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("inventory")
        .setLabel("📦 Inventory")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("progress")
        .setLabel("📈 Progress")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("trade")
.setLabel("🤝 Trade")
.setStyle(ButtonStyle.Danger)
    );

  try {

    if (
      data.config.eventMessageId
    ) {

      const msg =
        await channel.messages.fetch(
          data.config.eventMessageId
        );

      await msg.edit({
        embeds: [embed],
        components: [row]
      });

    } else {

      const sent =
        await channel.send({
          embeds: [embed],
          components: [row]
        });

      data.config.eventMessageId =
        sent.id;

      save();
    }

  } catch {

    const sent =
      await channel.send({
        embeds: [embed],
        components: [row]
      });

    data.config.eventMessageId =
      sent.id;

    save();
  }
}

/* ================= LEADERBOARD ================= */

function getProgressCount(player) {

  const copy = {};

  for (
    const key in player.letters
  ) {
    copy[key] =
      player.letters[key];
  }

  let count = 0;

  for (
    const letter of TARGET_WORD
  ) {

    if (
      copy[letter] &&
      copy[letter] > 0
    ) {

      copy[letter]--;
      count++;
    }
  }

  return count;
}

async function updateLeaderboard() {

  const channel =
    await client.channels.fetch(
      LEADERBOARD_CHANNEL_ID
    );

  const players =
    Object.entries(
      data.players
    )
    .sort((a,b) => {

      return (
        getProgressCount(b[1]) -
        getProgressCount(a[1])
      );

    })
    .slice(0,10);

  let ranking =
    "Belum ada peserta";

  if (
    players.length > 0
  ) {

    ranking =
      players.map(
        (p,i) => {

          const medal =
            i===0 ? "🥇" :
            i===1 ? "🥈" :
            i===2 ? "🥉" :
            `${i+1}.`;

          return (
`${medal} <@${p[0]}> — ${getProgressCount(p[1])}/${TARGET_WORD.length}`
          );

        }
      ).join("\n");
  }

  const embed =
    new EmbedBuilder()
    .setTitle(
      "🏆 MONTHLY LETTER HUNT"
    )
    .setDescription(`
🎁 Hadiah

🥇 100 Robux
🥈 75 Robux
🥉 50 Robux

━━━━━━━━━━

${ranking}

━━━━━━━━━━

👥 Peserta:
${Object.keys(data.players).length}
`)
    .setColor("Gold");

  try {

    if (
      data.config
      .leaderboardMessageId
    ) {

      const msg =
        await channel.messages.fetch(
          data.config
          .leaderboardMessageId
        );

      await msg.edit({
        embeds:[embed]
      });

    } else {

      const sent =
        await channel.send({
          embeds:[embed]
        });

      data.config
      .leaderboardMessageId =
      sent.id;

      save();
    }

  } catch {

    const sent =
      await channel.send({
        embeds:[embed]
      });

    data.config
    .leaderboardMessageId =
    sent.id;

    save();
  }
}

/* ================= BUTTONS ================= */

client.on(
  "interactionCreate",
  async (i) => {

    if (!i.isButton())
      return;

    const player =
      getPlayer(i.user.id);

/* ===== TRADE ===== */

if (
  i.customId === "trade"
) {

  return i.reply({
    content:
`🤝 Sistem Trade

Ketik command:

!trade @user HURUFMU HURUFDIA

Contoh:

!trade @Budi I R

Artinya:

Kamu memberi I
Kamu meminta R`,
    ephemeral: true
  });
}

    /* ===== GACHA ===== */

    if (
      i.customId === "gacha"
    ) {

      if (
        player.tokens <= 0
      ) {

        return i.reply({
          content:
            "❌ Token kamu habis.",
          ephemeral: true
        });
      }

      player.tokens--;

      const letter =
        randomLetter();

      if (
        !player.letters[letter]
      ) {
        player.letters[letter] = 0;
      }

      player.letters[letter]++;

      save();

updateLeaderboard();

return i.reply({
        content:
          `🎉 Kamu mendapatkan huruf:\n\n**${letter}**`,
        ephemeral: true
      });
    }

    /* ===== INVENTORY ===== */

    if (
      i.customId === "inventory"
    ) {

      let text = "";

      for (
        const letter in player.letters
      ) {

        text +=
          `${letter} x${player.letters[letter]}\n`;
      }

      if (!text)
        text = "Belum punya huruf";

      return i.reply({
        content: text,
        ephemeral: true
      });
    }
/* ===== PROGRESS ===== */

if (
  i.customId === "progress"
) {

  let completed = 0;

  const copy = {};

  for (
    const key in player.letters
  ) {
    copy[key] =
      player.letters[key];
  }

  let progressText = "";

  for (
    const letter of TARGET_WORD
  ) {

    if (
      copy[letter] &&
      copy[letter] > 0
    ) {

      progressText += letter;

      copy[letter]--;

      completed++;

    } else {

      progressText += "_";
    }
  }

  return i.reply({
    content:
`🎯 Target

${TARGET_WORD}

━━━━━━━━━━

${progressText}

━━━━━━━━━━

${completed}/${TARGET_WORD.length}`,
    ephemeral: true
  });
}
  }
);

client.once(
  "ready",
  async () => {

    console.log(
      "LETTER HUNT ONLINE 🔥"
    );

    await updateEventPanel();

await updateLeaderboard();
  }
);

client.login(TOKEN);