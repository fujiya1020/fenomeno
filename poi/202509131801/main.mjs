// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Partials, REST, Routes, Events } from 'discord.js';
import "dotenv/config"
import express from 'express';
import { loadTasks, saveTasks } from './storeage.mjs';

// .envファイルから環境変数を読み込み
dotenv.config();

// Discord Botクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // サーバー情報取得
        GatewayIntentBits.GuildMessages,    // メッセージ取得
        GatewayIntentBits.MessageContent,   // メッセージ内容取得
        GatewayIntentBits.GuildMembers,     // メンバー情報取得
    ],
 partials: [Partials.Channel],
});

// Botが起動完了したときの処理
client.once('ready', () => {
    console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
    console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
});

let tasks = loadTasks();
for ( let cmd of Object.keys(commandConfigs)) {
    if(!tasks[cmd]) tasks[cmd] = [];
}

// --- コマンド一覧　&　メッセージテンプレ ---
const commandConfigs = {
    saiketu: {
        description: "最強決定戦の締切管理",
        chanmi: (date) => `📝【タスク・パターン1】 締切: ${date}`,
        loh:    (date) => `📝【タスク・パターン2】 締切: ${date}`,
        remind: "最強決定戦の締切は明日０時です！",
        deadline: "最強決定戦受付終了です！",
    },
    sdgscup: {
        description: "SDG's CUPの締切管理",
        chanmi: (date) => `締切: ${date}`,
        loh:    (date) => `締切: ${date}`,
        remind: "SDG's CUPの開催は明日です！",
        deadline: "",
    },
    srhai: {
        description: "えすあーる杯の締切管理",
        chanmi: (date) => `締切: ${date}`,
        loh:    (date) => `締切: ${date}`,
        remind: "えすあーる杯の開催は明日です！",
        deadline: "",
    },
    satai: {
        description: "サークル対抗戦の締切管理",
        chanmi: (date) => `締切: ${date}`,
        loh:    (date) => `締切: ${date}`,
        remind: "サークル対抗戦の参加締切は明日０時です！",
        deadline: "サークル対抗戦参加受付終了です！",
    },
    jewelry: {
        description: "ジュエリーカップの締切管理",
        chanmi: (date) => `締切: ${date}`,
        loh:    (date) => `締切: ${date}`,
        remind: "ジュエリーカップの参加締切は明日０時です！",
        deadline: "ジュエリーカップ参加受付終了です！",
    },
    scenario: {
        description: "シナリオ対抗戦の締切管理",
        chanmi: (date) => `締切: ${date}`,
        loh:    (date) => `締切: ${date}`,
        remind: "シナリオ対抗戦の参加締切は明日０時です！",
        deadline: "シナリオ対抗戦受付終了です！",
    },
};

// ---- スラッシュコマンド定義 ----
const commands = Object.entries(commandConfigs).map(([name, cfg]) => ({
    name,
    description: cfg.description,
}));

const rest = new REST({ version: "10"}).setToken(process.env.DISCORD_TOKEN);

// コマンド登録
(async () => {
    try {
        console.log("コマンドを登録中...");
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("コマンド登録完了");
    } catch (error) {
        console.error(error);
    }
})();

// ---- 共通処理 ----
async function handleTaskCommand(interaction, commandName) {
  const channel = interaction.channel;
  const userId = interaction.user.id;

  await interaction.reply(`テンプレートを選んでください: \`1\` または \`2\``);

  // パターン選択
  const filter = (m) => m.author.id === userId && ["1", "2"].includes(m.content.trim());
  let collected;
  try {
    collected = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] });
  } catch {
    return channel.send("⏰ 時間切れです。最初からやり直してください。");
  }
  const pattern = collected.first().content.trim();

  await channel.send("締切日を入力してください (例: 2025-09-20)");

  // 締切日入力
  const dateFilter = (m) => m.author.id === userId;
  let dateCollected;
  try {
    dateCollected = await channel.awaitMessages({
      filter: dateFilter,
      max: 1,
      time: 60000,
      errors: ["time"],
    });
  } catch {
    return channel.send("⏰ 時間切れです。最初からやり直してください。");
  }

  const deadlineInput = dateCollected.first().content.trim();
  const deadline = new Date(`${deadlineInput}T00:00:00+09:00`);
  if (isNaN(deadline.getTime())) {
    return channel.send("⚠️ 日付の形式が正しくありません。YYYY-MM-DD 形式で入力してください。");
  }

  // 保存
  tasks[commandName].push({
    userId,
    channelId: channel.id,
    deadline,
    pattern,
  });

  saveTasks(tasks);

  // テンプレート生成
  const cfg = commandConfigs[commandName];
  const message = pattern === "1" ? cfg.pattern1(deadlineInput) : cfg.pattern2(deadlineInput);

  await channel.send(`✅ 登録しました\n${message}`);
}

// ---- コマンドイベント ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (commandConfigs[interaction.commandName]) {
    handleTaskCommand(interaction, interaction.commandName);
  }
});

// ---- 定期チェック ----
setInterval(async () => {
  const now = new Date();
  for (let task of tasks) {
    const channel = await client.channels.fetch(task.channelId);
    const cfg = commandConfigs[task.command];

    // 前日12:00 リマインド
    const remindTime = new Date(task.deadline);
    remindTime.setDate(remindTime.getDate() - 1);
    remindTime.setHours(12, 0, 0, 0);

    if (now >= remindTime && now < new Date(remindTime.getTime() + 60000)) {
      await channel.send(cfg.remind);
    }

     // 当日0:00 締切通知
    const deadlineTime = new Date(task.deadline);
    deadlineTime.setHours(0, 0, 0, 0);

    if (now >= deadlineTime && now < new Date(deadlineTime.getTime() + 60000)) {
      await channel.send(cfg.deadline);
    }
  }
}, 60000);

client.once(Events.ClientReady, (c) => {
  console.log(`ログイン完了: ${c.user.tag}`);
});

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

// サーバー起動
app.listen(port, () => {
    console.log(`🌐 Web サーバーがポート ${port} で起動しました`);
});