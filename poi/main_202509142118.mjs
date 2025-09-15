import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Partials,
  Events,
} from "discord.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

// ==== Bot & Server 起動 ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

const app = express();
app.get("/", (req, res) => res.send("Bot稼働中"));
app.listen(3000, () => console.log("Webサーバー起動: 3000"));

// ==== コマンド日本語表示名 & テンプレート内容 ====
const commandConfig = {
  saiketu: {
    jpName: "最強決定戦",
    templates: {
      //1: "採決テンプレート1: 投票を忘れずに！",
      2: "・1人3ウマ娘　9人建て　予選(1日3，4レースを数日間)→準決勝→決勝\n・育成締切日は予選開始前日23:59とし、個体変更は不可です。",
      3: "採決テンプレート3: 参加をお忘れなく！",
      
    },
  },
  sdgscup: {
    jpName: "SDG's CUP",
    templates: {
      1: "SDGs CUPテンプレート1: 環境に配慮して参加しましょう！",
      //2: "SDGs CUPテンプレート2: 環境に配慮して参加しましょう！",
      //3: "SDGs CUPテンプレート3: チームメンバーを集めてください！",
      //4: "SDGs CUPテンプレート4: 締切まであとわずかです！",
      
    },
  },
  srhai: {
    jpName: "えすあーる杯",
    templates: {
      1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      //4: "SR杯テンプレート4: 最後のチャンスです！",
    },
  },
  satai: {
    jpName: "サークル対抗戦",
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "サークル対抗戦テンプレート4: 最後のチャンスです！",
    },
  },
  jewelry: {
    jpName: "ジュエリーカップ",
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "ジュエリーカップテンプレート4: 最後のチャンスです！",
    },
  },
  scenario: {
    jpName: "シナリオ対抗戦",
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "シナリオ対抗戦テンプレート4: 最後のチャンスです！",
    },
  },
};

// ==== Slash コマンド登録 ====
const commands = Object.keys(commandConfig).map((name) =>
  new SlashCommandBuilder()
    .setName(name)
    .setDescription(`${commandConfig[name].jpName}の募集メッセージを作成`)
    .toJSON()
);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("コマンド登録完了");
  } catch (err) {
    console.error(err);
  }
})();

// ==== タスク管理 ====
let tasks = {}; // { commandName: { deadline: Date, pattern: string, channelId: string } }

// ==== コマンド処理 ====
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const cfg = commandConfig[commandName];
      const availableTemplates = Object.keys(cfg.templates);

      const row = new ActionRowBuilder();
      if (availableTemplates.includes("1")) row.addComponents(new ButtonBuilder().setCustomId(`template1_${commandName}`).setLabel("ノーマル").setStyle(ButtonStyle.Primary));
      if (availableTemplates.includes("2")) row.addComponents(new ButtonBuilder().setCustomId(`template2_${commandName}`).setLabel("チャンミレギュ").setStyle(ButtonStyle.Secondary));
      if (availableTemplates.includes("3")) row.addComponents(new ButtonBuilder().setCustomId(`template3_${commandName}`).setLabel("LOHレギュ").setStyle(ButtonStyle.Success));
      if (availableTemplates.includes("4")) row.addComponents(new ButtonBuilder().setCustomId(`template4_${commandName}`).setLabel("外部大会").setStyle(ButtonStyle.Danger));

      await interaction.reply({ content: "①使用するテンプレートを選んでください", components: [row], flags: 64 });
    }

    if (interaction.isButton()) {
      const [templateId, commandName] = interaction.customId.split("_");
      const pattern = templateId.replace("template", "");
      const modal = new ModalBuilder()
        .setCustomId(`deadlineModal_${commandName}_${pattern}`)
        .setTitle("締切日入力")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("deadlineInput").setLabel("締切日を入力 (YYYY-MM-DD)").setStyle(TextInputStyle.Short).setPlaceholder("例: 2025-09-20").setRequired(true)
          )
        );

      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      const [_, commandName, pattern] = interaction.customId.split("_");
      const deadlineStr = interaction.fields.getTextInputValue("deadlineInput");
      const deadline = new Date(`${deadlineStr}T00:00:00+09:00`);
      if (isNaN(deadline.getTime())) return interaction.reply({ content: "⚠️ 日付形式が正しくありません。YYYY-MM-DDで入力してください。", flags: 64 });

      // 開催日=締切日の3日後
      const eventDate = new Date(deadline);
      eventDate.setDate(eventDate.getDate()+3);
      const eventStr = eventDate.toISOString().slice(0, 10);

      const channel = interaction.channel;
      const jpName = commandConfig[commandName].jpName;
      const templateText = commandConfig[commandName].templates[pattern];

      const messageContent = `📢 ${jpName} の募集を開始します！\n${templateText}\n締切日: ${deadlineStr}\n予選開始日: ${eventStr}`;
      await channel.send(messageContent);

      tasks[commandName] = { deadline, pattern, channelId: channel.id };

      await interaction.reply({ content: `✅ 募集メッセージを作成しました (締切: ${deadlineStr})`, flags: 64 });
    }
  } catch (err) {
    console.error(err);
  }
});

// ==== 定期チェック（締切リマインド・締切当日通知） ====
setInterval(async () => {
  const now = new Date();
  for (const [commandName, task] of Object.entries(tasks)) {
    const channel = await client.channels.fetch(task.channelId);
    if (!channel) continue;

    const deadline = new Date(task.deadline);
    const remindTime = new Date(deadline);
    remindTime.setHours(-12, 0, 0, 0); // 締切12時間前
    const deadlineTime = new Date(deadline);
    deadlineTime.setHours(0, 0, 0, 0);

    // リマインド通知
    if (now >= remindTime && now < new Date(remindTime.getTime() + 60000)) {
      await channel.send(`⏰ ${commandConfig[commandName].jpName} の締切は12時間後です！`);
    }

    // 締切通知
    if (now >= deadlineTime && now < new Date(deadlineTime.getTime() + 60000)) {
      await channel.send(`🚨 ${commandConfig[commandName].jpName} の締切が終了しました！`);
      delete tasks[commandName];
    }
  }
}, 60000);

// ==== ログイン ====
client.login(process.env.DISCORD_TOKEN);
