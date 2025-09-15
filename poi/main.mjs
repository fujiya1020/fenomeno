import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} from "discord.js";
import fs from "fs";
import dotenv from "dotenv";
import express from 'express';

dotenv.config(); // .env 読み込み

// -------------------- 設定 --------------------
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const reactionEmoji = "✅"; // 汎用絵文字

// -------------------- Discordクライアント --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Botが起動完了したときの処理
client.once('ready', () => {
    console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
    console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
});

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

// -------------------- コマンド設定 --------------------
const commandConfigs = {
  saiketu: {
    hasReactionRole: false,
    reactionRoleId: null,
    pattern1: (deadline) => `📌 【採決-パターン1】締切は ${deadline}`,
    pattern2: (deadline) => `📌 【採決-パターン2】締切は ${deadline}`,
  },
  sdgscup: {
    hasReactionRole: true,
    reactionRoleId: process.env.ROLE_ID_SDGSCUP,
    pattern1: (deadline) => `🏆 【SDGs Cup-A】締切 ${deadline}`,
    pattern2: (deadline) => `🏆 【SDGs Cup-B】締切 ${deadline}`,
  },
  srhai: {
    hasReactionRole: true,
    reactionRoleId: process.env.ROLE_ID_SRHAI,
    pattern1: (deadline) => `🎯 【SR杯-案1】締切 ${deadline}`,
    pattern2: (deadline) => `🎯 【SR杯-案2】締切 ${deadline}`,
  },
  satai: {
    hasReactionRole: false,
    reactionRoleId: null,
    pattern1: (deadline) => `📝 【佐大会-形式1】締切 ${deadline}`,
    pattern2: (deadline) => `📝 【佐大会-形式2】締切 ${deadline}`,
  },
  jewelry: {
    hasReactionRole: false,
    reactionRoleId: null,
    pattern1: (deadline) => `💎 【Jewelry-Plan1】締切 ${deadline}`,
    pattern2: (deadline) => `💎 【Jewelry-Plan2】締切 ${deadline}`,
  },
  scenario: {
    hasReactionRole: false,
    reactionRoleId: null,
    pattern1: (deadline) => `📖 【シナリオ-Type1】締切 ${deadline}`,
    pattern2: (deadline) => `📖 【シナリオ-Type2】締切 ${deadline}`,
  },
};

// -------------------- タスク保存 --------------------
const TASK_FILE = "tasks.json";
let tasks = {};
if (fs.existsSync(TASK_FILE)) {
  tasks = JSON.parse(fs.readFileSync(TASK_FILE));
}
function saveTasks(data) {
  fs.writeFileSync(TASK_FILE, JSON.stringify(data, null, 2));
}

// -------------------- スラッシュコマンド登録 --------------------
const commands = Object.keys(commandConfigs).map((name) =>
  new SlashCommandBuilder().setName(name).setDescription(`${name} を開始します`)
);

const rest = new REST({ version: "10" }).setToken(token);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

// -------------------- スラッシュコマンド処理 --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  if (!commandConfigs[commandName]) return;
  await handleTaskCommand(interaction, commandName);
});

// -------------------- テンプレ選択 --------------------
async function askTemplate(interaction, userId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("template1").setLabel("テンプレ1").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("template2").setLabel("テンプレ2").setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.reply({
    content: "テンプレートを選択してください",
    components: [row],
    fetchReply: true,
  });

  const filter = (i) => i.user.id === userId;
  const buttonInteraction = await message.awaitMessageComponent({ filter, time: 30000 });
  const pattern = buttonInteraction.customId === "template1" ? "1" : "2";

  await buttonInteraction.update({ content: `テンプレ${pattern}を選択しました`, components: [] });
  return pattern;
}

// -------------------- 締切入力 --------------------
async function askDeadline(channel, userId) {
  await channel.send("締切日を入力してください (例: 2025-09-20)");

  const filter = (m) => m.author.id === userId;
  const collected = await channel.awaitMessages({ filter, max: 1, time: 60000 });
  const deadlineInput = collected.first().content.trim();

  const deadline = new Date(`${deadlineInput}T00:00:00+09:00`);
  if (isNaN(deadline.getTime())) throw new Error("日付形式が不正です");

  return { deadline, deadlineInput };
}

// -------------------- メイン処理 --------------------
async function handleTaskCommand(interaction, commandName) {
  const channel = interaction.channel;
  const userId = interaction.user.id;
  const cfg = commandConfigs[commandName];

  const pattern = await askTemplate(interaction, userId);
  const { deadline, deadlineInput } = await askDeadline(channel, userId);

  // --- 古いロール削除 ---
  const oldTasks = tasks[commandName] || [];
  for (const oldTask of oldTasks) {
    if (oldTask.recruitmentMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(oldTask.recruitmentMessageId);
        const reaction = oldMessage.reactions.cache.get(reactionEmoji);
        if (reaction) {
          const users = await reaction.users.fetch();
          for (const [uid] of users) {
            if (uid === client.user.id) continue;
            const member = await channel.guild.members.fetch(uid);
            const role = channel.guild.roles.cache.get(cfg.reactionRoleId);
            if (role && member.roles.cache.has(role.id)) {
              await member.roles.remove(role);
            }
          }
        }
      } catch {}
    }
  }

  // --- 新タスク登録 ---
  const task = { userId, channelId: channel.id, deadline: deadline.toISOString(), pattern, recruitmentMessageId: null };
  tasks[commandName] = [task];
  saveTasks(tasks);

  const msgText = pattern === "1" ? cfg.pattern1(deadlineInput) : cfg.pattern2(deadlineInput);
  await channel.send(`✅ 登録しました\n${msgText}`);

  // 募集メッセージ
  const recruitmentMsg = await channel.send(`🎉 参加者募集です。締切は ${deadlineInput.slice(5).replace("-", "/")} です！`);
  if (cfg.hasReactionRole) await recruitmentMsg.react(reactionEmoji);

  task.recruitmentMessageId = recruitmentMsg.id;
  saveTasks(tasks);
}

// -------------------- リアクション監視 --------------------
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  for (const [cmd, taskList] of Object.entries(tasks)) {
    for (const task of taskList) {
      if (task.recruitmentMessageId === reaction.message.id && reaction.emoji.name === reactionEmoji) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(commandConfigs[cmd].reactionRoleId);
        if (role) await member.roles.add(role);
      }
    }
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  for (const [cmd, taskList] of Object.entries(tasks)) {
    for (const task of taskList) {
      if (task.recruitmentMessageId === reaction.message.id && reaction.emoji.name === reactionEmoji) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(commandConfigs[cmd].reactionRoleId);
        if (role) await member.roles.remove(role);
      }
    }
  }
});

// -------------------- リマインド・締切処理 --------------------
setInterval(async () => {
  const now = new Date();

  for (const [cmd, taskList] of Object.entries(tasks)) {
    for (const task of taskList) {
      const deadline = new Date(task.deadline);
      const channel = await client.channels.fetch(task.channelId);

      // 前日12:00にリマインド
      const remindTime = new Date(deadline);
      remindTime.setDate(remindTime.getDate() - 1);
      remindTime.setHours(12, 0, 0, 0);
      if (Math.abs(now - remindTime) < 1000 * 60) {
        await channel.send(`⏰ ${cmd} の締切は明日です！`);
      }

      // 当日0:00に締切
      if (Math.abs(now - deadline) < 1000 * 60) {
        await channel.send(`📢 ${cmd} の募集は締め切りました！`);
      }
    }
  }
}, 1000 * 60); // 1分ごとにチェック

// -------------------- 起動 --------------------
client.login(token);
