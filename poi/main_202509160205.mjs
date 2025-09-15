import { Client, GatewayIntentBits, Partials, REST, Routes, Events } from "discord.js";
import fs from "fs";
import "dotenv/config";
import express from 'express';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', ()=> {
    console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
    console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
});

// ---- コマンド設定 ----
const commandConfigs = {
  task: {
    description: "タスクを登録します",
    pattern1: (date) => `📝【タスク・パターン1】 締切: ${date}`,
    pattern2: (date) => `📝【タスク・パターン2】 締切: ${date}`,
    remind: "⏰ タスクの締切は明日です！",
    deadline: "🚨 タスクの締切になりました！",
    hasReactionRole: false,
  },
  report: {
    description: "レポートの締切を登録します",
    pattern1: (date) => `📑【レポート・パターン1】 提出締切: ${date}`,
    pattern2: (date) => `📑【レポート・パターン2】 提出締切: ${date}`,
    remind: "⏰ レポートの提出期限は明日です！",
    deadline: "🚨 レポートの提出期限が過ぎました！",
    hasReactionRole: false,
  },
  homework: {
    description: "宿題の締切を登録します",
    pattern1: (date) => `📘【宿題・パターン1】 締切: ${date}`,
    pattern2: (date) => `📘【宿題・パターン2】 締切: ${date}`,
    remind: "⏰ 宿題の締切は明日です！",
    deadline: "🚨 宿題の締切になりました！",
    hasReactionRole: false,
  },
  event: {
    description: "イベントの締切を登録します",
    pattern1: (date) => `🎉【イベント・パターン1】 締切: ${date}`,
    pattern2: (date) => `🎉【イベント・パターン2】 締切: ${date}`,
    remind: "⏰ イベントの締切は明日です！",
    deadline: "🚨 イベントの締切になりました！",
    hasReactionRole: true,
    reactionRoleId: "ロールIDをここに入れる",
  },
  meeting: {
    description: "会議の締切を登録します",
    pattern1: (date) => `📅【会議・パターン1】 締切: ${date}`,
    pattern2: (date) => `📅【会議・パターン2】 締切: ${date}`,
    remind: "⏰ 会議の締切は明日です！",
    deadline: "🚨 会議の締切になりました！",
    hasReactionRole: false,
  },
  project: {
    description: "プロジェクトの締切を登録します",
    pattern1: (date) => `📂【プロジェクト・パターン1】 締切: ${date}`,
    pattern2: (date) => `📂【プロジェクト・パターン2】 締切: ${date}`,
    remind: "⏰ プロジェクトの締切は明日です！",
    deadline: "🚨 プロジェクトの締切になりました！",
    hasReactionRole: false,
  },
};

// ---- スラッシュコマンド登録 ----
const commands = Object.entries(commandConfigs).map(([name, cfg]) => ({
  name,
  description: cfg.description,
}));
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("コマンド登録完了");
  } catch (err) {
    console.error(err);
  }
})();

// ---- JSON永続化 ----
const TASK_FILE = "./tasks.json";

function loadTasks() {
  if (!fs.existsSync(TASK_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(TASK_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveTasks(tasks) {
  fs.writeFileSync(TASK_FILE, JSON.stringify(tasks, null, 2));
}

// ---- タスク管理（コマンドごとに独立） ----
let tasks = loadTasks();
for (let cmd of Object.keys(commandConfigs)) {
  if (!tasks[cmd]) tasks[cmd] = [];
}

// ---- タスク登録処理 ----
async function handleTaskCommand(interaction, commandName) {
  const channel = interaction.channel;
  const userId = interaction.user.id;
  const cfg = commandConfigs[commandName];

  await interaction.reply(`テンプレートを選んでください: \`1\` または \`2\``);

  const filter = (m) => m.author.id === userId && ["1", "2"].includes(m.content.trim());
  let collected;
  try {
    collected = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] });
  } catch {
    return channel.send("⏰ 時間切れです。最初からやり直してください。");
  }
  const pattern = collected.first().content.trim();

  await channel.send("締切日を入力してください (例: 2025-09-20)");

  const dateFilter = (m) => m.author.id === userId;
  let dateCollected;
  try {
    dateCollected = await channel.awaitMessages({ filter: dateFilter, max: 1, time: 60000, errors: ["time"] });
  } catch {
    return channel.send("⏰ 時間切れです。最初からやり直してください。");
  }

  const deadlineInput = dateCollected.first().content.trim();
  const deadline = new Date(`${deadlineInput}T00:00:00+09:00`);
  if (isNaN(deadline.getTime())) return channel.send("⚠️ 日付形式が正しくありません。YYYY-MM-DD で入力してください。");

  // ---- 前回のタスクを削除（上書き） ----
  if (tasks[commandName].length > 0 && cfg.hasReactionRole) {
    const oldTask = tasks[commandName][0];
    if (oldTask.recruitmentMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(oldTask.recruitmentMessageId);
        const guild = channel.guild;
        const role = guild.roles.cache.get(cfg.reactionRoleId);
        const users = await oldMessage.reactions.cache.get("✅")?.users.fetch() || [];
        for (const [uid, user] of users) {
          if (!user.bot) {
            const member = await guild.members.fetch(uid);
            await member.roles.remove(role);
          }
        }
        await oldMessage.delete().catch(() => {});
      } catch {}
    }
  }

  // ---- 新しいタスク登録 ----
  let task = { userId, channelId: channel.id, deadline: deadline.toISOString(), pattern };
  if (cfg.hasReactionRole) task.recruitmentMessageId = null; // 後で設定

  tasks[commandName] = [task];
  saveTasks(tasks);

  const message = pattern === "1" ? cfg.pattern1(deadlineInput) : cfg.pattern2(deadlineInput);
  await channel.send(`✅ 登録しました\n${message}`);

  // ---- 募集メッセージ＋リアクションロール ----
  if (cfg.hasReactionRole) {
    const recruitmentMsg = await channel.send(`🎉 参加者募集です。締切は ${deadlineInput.slice(5).replace("-", "/")} です！`);
    await recruitmentMsg.react("✅");
    task.recruitmentMessageId = recruitmentMsg.id;
    saveTasks(tasks);
  }
}

// ---- コマンドイベント ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (commandConfigs[interaction.commandName]) {
    handleTaskCommand(interaction, interaction.commandName);
  }
});

// ---- リアクションでロール付与 ----
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  for (let [commandName, taskList] of Object.entries(tasks)) {
    const cfg = commandConfigs[commandName];
    if (!cfg.hasReactionRole) continue;

    for (let task of taskList) {
      if (task.recruitmentMessageId === reaction.message.id) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(cfg.reactionRoleId);
        if (role) await member.roles.add(role);
      }
    }
  }
});

// ---- 定期チェック（リマインド・締切通知） ----
setInterval(async () => {
  const now = new Date();
  for (let [commandName, taskList] of Object.entries(tasks)) {
    const cfg = commandConfigs[commandName];
    for (let task of taskList) {
      const channel = await client.channels.fetch(task.channelId);
      const deadline = new Date(task.deadline);

      const deadlineJST = new Date(deadline.getTime() + 9 * 60 * 60 * 1000);

      const remindTime = new Date(deadlineJST);
      remindTime.setDate(remindTime.getDate() - 1);
      remindTime.setHours(12, 0, 0, 0);

      const deadlineTime = new Date(deadlineJST);
      deadlineTime.setHours(0, 0, 0, 0);

      if (now >= remindTime && now < new Date(remindTime.getTime() + 60000)) {
        await channel.send(cfg.remind);
      }
      if (now >= deadlineTime && now < new Date(deadlineTime.getTime() + 60000)) {
        await channel.send(cfg.deadline);
      }
    }
  }
}, 60000);

// ---- Bot起動 ----
client.once(Events.ClientReady, (c) => console.log(`ログイン完了: ${c.user.tag}`));
client.login(process.env.DISCORD_TOKEN);

// エラーハンドリング
client.on('error', (error) => {
    console.error('❌ Discord クライアントエラー:', error);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
    console.log('🛑 Botを終了しています...');
    client.destroy();
    process.exit(0);
});

// Discord にログイン
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN が .env ファイルに設定されていません！');
    process.exit(1);
}

console.log('🔄 Discord に接続中...');
client.login(process.env.DISCORD_TOKEN)
    .catch(error => {
        console.error('❌ ログインに失敗しました:', error);
        process.exit(1);
    });

// Express Webサーバーの設定（Render用）
const app = express();
const port = process.env.PORT || 3000;

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running! 🤖',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});