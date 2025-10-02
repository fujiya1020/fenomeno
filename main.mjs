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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

const app = express();
app.get("/", (req, res) => res.send("Bot稼働中"));
app.listen(3000, () => console.log("Webサーバー起動: 3000"));

// ==== コマンド日本語表示名 & テンプレート内容 ====
const commandConfig = {
  saiketu: {
    jpName: "最強決定戦",
    image: "https://cdn.discordapp.com/attachments/1207888867772858459/1414753471651119135/1f9164eaddeac575.png",
    templates: {
      2: "・1人3ウマ娘　9人建て　予選(1日3，4レースを数日間)→準決勝→決勝\n・育成締切日は予選開始前日23:59とし、個体変更は不可です。\n・決勝戦はSDG's CUP、えすあーる杯と同日です。",
      3: "・1レース12頭立て　トレーナー2人（各3ウマ娘）+モブ6人\n・予選総当たり→準決勝（参加人数次第）→決勝\n・1レースごとに順位によりポイントを付与、獲得合計ポイントにより勝敗を決します。\n・予選は勝利数により順位決定、並んだ場合は予選での直接対決の結果を参照します。\n・個体締切は予選開始の1日前、予選開始以降、キャラの差し替えは禁止です。",
    },
  },
  sdgscup: {
    jpName: "SDG's CUP",
    image: "https://cdn.discordapp.com/attachments/1207888498942677003/1414751719908442233/SDGsCUP.png",
    templates: {
      1: "・1人1ウマ娘一発勝負\n",
    },
    roleId: process.env.SDG_ROLE_ID, // ここに付与したいロールID
  },
  srhai: {
    jpName: "えすあーる杯",
    image: "https://cdn.discordapp.com/attachments/1214370384854388837/1414752832980127745/f4f69879c3f7af96.png",
    templates: {
      2: "・1人1ウマ娘一発勝負\n・自前はR・SRのみ、フレ枠SSR可\n・定員9名",
      3: "・1人1ウマ娘一発勝負\n・自前はR・SRのみ、フレ枠SSR可\n・定員12名",
    },
    roleId: process.env.SR_ROLE_ID, // ここに付与したいロールID
  },
  satai: {
    jpName: "サークル対抗戦",
    image: null,
    templates: {
      4: "※サークル対抗戦は、開催日の昼～夜にかけてリアルタイムで進行するであります。\n開催日は連絡が取れる態勢、ウマ娘を開ける環境を整えていただきますようご協力お願いします！\n\n選抜戦ルール\nチャンミ→1着回数多い人から抜け、並んだ場合はサドンデス\nLOH→獲得pt多い順",
    },
  },
  jewelry: { jpName: "ジュエリーカップ", image: null, templates: { 4: "選抜戦ルール\n1着回数多い人から抜け、並んだ場合はサドンデス" } },
  scenario: { jpName: "シナリオ対抗戦", image: null, templates: { 4: "選抜戦ルール\n1着回数多い人から抜け、並んだ場合はサドンデス" } },
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
let tasks = {}; // { commandName: { deadline, eventDate, pattern, conditions, channelId } }

// ==== コマンド処理 ====
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 1. Slash Command
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const cfg = commandConfig[commandName];
      const availableTemplates = Object.keys(cfg.templates);

      const row = new ActionRowBuilder();
      if (availableTemplates.includes("1")) row.addComponents(new ButtonBuilder().setCustomId(`template1_${commandName}`).setLabel("サークルイベント").setStyle(ButtonStyle.Primary));
      if (availableTemplates.includes("2")) row.addComponents(new ButtonBuilder().setCustomId(`template2_${commandName}`).setLabel("最決チャンミ").setStyle(ButtonStyle.Secondary));
      if (availableTemplates.includes("3")) row.addComponents(new ButtonBuilder().setCustomId(`template3_${commandName}`).setLabel("最決LOH").setStyle(ButtonStyle.Success));
      if (availableTemplates.includes("4")) row.addComponents(new ButtonBuilder().setCustomId(`template4_${commandName}`).setLabel("外部大会").setStyle(ButtonStyle.Danger));

      await interaction.reply({ content: "①使用するテンプレートを選んでください", components: [row], ephemeral: true });
    }

    // 2. ボタン → モーダル
    if (interaction.isButton()) {
      const [templateId, commandName] = interaction.customId.split("_");
      const pattern = templateId.replace("template", "");

      const modal = new ModalBuilder()
        .setCustomId(`recruitModal_${commandName}_${pattern}`)
        .setTitle("募集設定")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("deadlineInput").setLabel("締切日を入力 (YYYY-MM-DD)").setStyle(TextInputStyle.Short).setPlaceholder("例: 2025-09-20").setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("conditionInput").setLabel("ゲーム条件を入力してください").setStyle(TextInputStyle.Paragraph).setPlaceholder("例: レース条件/人数/予選日程").setRequired(true)
          )
        );

      await interaction.showModal(modal);
    }

    // 3. モーダル送信 → 募集メッセージ作成
    if (interaction.isModalSubmit() && interaction.customId.startsWith("recruitModal")) {
      await interaction.deferReply({ ephemeral: true });

      const [_, commandName, pattern] = interaction.customId.split("_");
      const deadlineStr = interaction.fields.getTextInputValue("deadlineInput");
      const conditions = interaction.fields.getTextInputValue("conditionInput");

      const deadline = new Date(`${deadlineStr}T00:00:00+09:00`);
      if (isNaN(deadline.getTime())) {
        return interaction.editReply({ content: "⚠️ 日付形式が正しくありません。YYYY-MM-DDで入力してください。" });
      }

      const deadlineFmt = deadline.toISOString().slice(0, 10);
      const jpName = commandConfig[commandName].jpName;
      const templateText = commandConfig[commandName].templates[pattern];
      const imageUrl = commandConfig[commandName].image;

      const messageContent = `📢 ボス！　${jpName} の募集案内が来ました！\n\n${templateText}\n\n締切日: ${deadlineFmt} 23:59\n\n🎮 レギュレーション\n${conditions}\n\n参加してくださるトレーナーの皆様は✅リアクションお願いします！`;

      const channel = await client.channels.fetch(interaction.channel.id);

      // 💡 新メッセージ作成前にロールリセット（SDG's CUP / えすあーる杯のみ）
      if (["sdgscup", "srhai"].includes(commandName)) {
        const roleId = commandConfig[commandName].roleId;
        if (roleId) {
          const guild = channel.guild;
          const role = await guild.roles.fetch(roleId);
          if (role) {
            const membersWithRole = role.members;
            for (const member of membersWithRole.values()) {
              await member.roles.remove(roleId).catch(console.error);
            }
            console.log(`♻️ ${commandName} のロールをリセットしました`);
          }
        }
      }

      let sentMessage;
      if (imageUrl) {
        sentMessage = await channel.send({ content: messageContent, files: [imageUrl] });
      } else {
        sentMessage = await channel.send(messageContent);
      }

      // デフォルトで ✅ リアクション追加
      await sentMessage.react("✅");

      // タスク保存
      tasks[commandName] = { deadline, pattern, conditions, channelId: interaction.channel.id, messageId: sentMessage.id };

      await interaction.editReply({ content: `✅ 募集メッセージを作成しました\n(締切: ${deadlineFmt}, 条件: ${conditions})` });
    }

  } catch (err) {
    console.error(err);
  }
});

// ==== リアクション追加時にロール付与 ====
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();

    const msg = reaction.message;

    for (const commandName of ["sdgscup", "srhai"]) {
      const task = tasks[commandName];
      if (!task || msg.id !== task.messageId) continue;

      const roleId = commandConfig[commandName].roleId;
      if (!roleId) continue;

      const member = await msg.guild.members.fetch(user.id);
      if (!member) continue;

      await member.roles.add(roleId);
      console.log(`✅ ${user.tag} に ${commandName} のロール付与`);
    }
  } catch (err) {
    console.error(err);
  }
});

// ==== 定期チェック（リマインド・締切通知） ====
setInterval(async () => {
  const now = new Date();
  for (const [commandName, task] of Object.entries(tasks)) {
    if (!task.deadline) continue;
    const channel = await client.channels.fetch(task.channelId);
    if (!channel) continue;

    const deadline = new Date(task.deadline);
    const remindTime = new Date(deadline.getTime() - 12 * 60 * 60 * 1000); // 12時間前
    const deadlineTime = new Date(deadline);

    if (now >= remindTime && now < new Date(remindTime.getTime() + 60000)) {
      await channel.send(`⏰ ボス！${commandConfig[commandName].jpName} の締切は12時間後であります！\n参加表明まだの方はお急ぎください！`);
    }

    if (now >= deadlineTime && now < new Date(deadlineTime.getTime() + 60000)) {
      await channel.send(`🚨 ボス！${commandConfig[commandName].jpName} の参加募集は終了であります！`);
      delete tasks[commandName];
    }
  }
}, 60000);

// ==== ログイン ====
client.login(process.env.DISCORD_TOKEN);
