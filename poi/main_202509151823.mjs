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
    image: "https://media.discordapp.net/attachments/1207888867772858459/1392504407433936986/6f8829d888098eb1.png?ex=68c8c38a&is=68c7720a&hm=6be5125ea0b2365d2ea65fef5a3472ea33b4c865413f83ea6fbfe61d80a13b81&=&format=webp&quality=lossless&width=565&height=799",
    templates: {
      //1: "採決テンプレート1: 投票を忘れずに！",
      2: "・1人3ウマ娘　9人建て　予選(1日3，4レースを数日間)→準決勝→決勝\n・育成締切日は予選開始前日23:59とし、個体変更は不可です。\n・決勝戦はSDG's CUP、えすあーる杯と同日です。",
      3: "・1レース12頭立て　トレーナー2人（各3ウマ娘）+モブ6人\n・予選総当たり→準決勝（参加人数次第）→決勝\n・1レースごとに順位によりポイントを付与、獲得合計ポイントにより勝敗を決します。\n・予選は勝利数により順位決定、並んだ場合は予選での直接対決の結果を参照します。\n・個体締切は予選開始の1日前、予選開始以降、キャラの差し替えは禁止です。",
    },
  },
  sdgscup: {
    jpName: "SDG's CUP",
    image: "https://media.discordapp.net/attachments/1207888498942677003/1414751719908442233/SDGsCUP.png?ex=68c89eb6&is=68c74d36&hm=dd8c0e538275dcbd7b4bc00817d425ff8210c7a9a473617afa0c4fcc9145588b&=&format=webp&quality=lossless&width=309&height=438",
    templates: {
      1: "・1人1ウマ娘一発勝負\n",
      //2: "SDGs CUPテンプレート2: 環境に配慮して参加しましょう！",
      //3: "SDGs CUPテンプレート3: チームメンバーを集めてください！",
      //4: "SDGs CUPテンプレート4: 締切まであとわずかです！",

    },
  },
  srhai: {
    jpName: "えすあーる杯",
    image: "https://media.discordapp.net/attachments/1214370384854388837/1414752832980127745/f4f69879c3f7af96.png?ex=68c89fc0&is=68c74e40&hm=88974d395c6495efb599c5a61befc540f16049f432bb3ba9b6ca1041dbcac17c&=&format=webp&quality=lossless&width=309&height=438",
    templates: {
      //1: "・1人1ウマ娘一発勝負\n・自前はR・SRのみ、フレ枠SSR可",
      2: "・1人1ウマ娘一発勝負\n・自前はR・SRのみ、フレ枠SSR可\n・定員9名",
      3: "・1人1ウマ娘一発勝負\n・自前はR・SRのみ、フレ枠SSR可\n・定員12名",
      //4: "SR杯テンプレート4: 最後のチャンスです！",
    },
  },
  satai: {
    jpName: "サークル対抗戦",
    image: null,
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "※サークル対抗戦は、開催日の昼～夜にかけてリアルタイムで進行するであります。\n開催日は連絡が取れる態勢、ウマ娘を開ける環境を整えていただきますようご協力お願いします！\n\n選抜戦ルール\nチャンミ→1着回数多い人から抜け、並んだ場合はサドンデス\nLOH→獲得pt多い順",
    },
  },
  jewelry: {
    jpName: "ジュエリーカップ",
    image: null,
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "選抜戦ルール\n1着回数多い人から抜け、並んだ場合はサドンデス",
    },
  },
  scenario: {
    jpName: "シナリオ対抗戦",
    image: null,
    templates: {
      //1: "SR杯テンプレート1: 熱い戦いを楽しもう！",
      //2: "SR杯テンプレート2: 参加者募集中！",
      //3: "SR杯テンプレート3: 締切が迫っています！",
      4: "選抜戦ルール\n1着回数多い人から抜け、並んだ場合はサドンデス",
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
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
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
    console.log("Interaction type:", interaction.type);

    // 1. Slash Command
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const cfg = commandConfig[commandName];
      const availableTemplates = Object.keys(cfg.templates);

      const row = new ActionRowBuilder();
      if (availableTemplates.includes("1"))
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`template1_${commandName}`)
            .setLabel("サークルイベント")
            .setStyle(ButtonStyle.Primary)
        );
      if (availableTemplates.includes("2"))
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`template2_${commandName}`)
            .setLabel("最決チャンミ")
            .setStyle(ButtonStyle.Secondary)
        );
      if (availableTemplates.includes("3"))
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`template3_${commandName}`)
            .setLabel("最決LOH")
            .setStyle(ButtonStyle.Success)
        );
      if (availableTemplates.includes("4"))
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`template4_${commandName}`)
            .setLabel("外部大会")
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.reply({
        content: "①使用するテンプレートを選んでください",
        components: [row],
        ephemeral: true,
      });
    }

    // 2. ボタン → 締切日 + 条件をまとめたモーダル
    if (interaction.isButton()) {
      const [templateId, commandName] = interaction.customId.split("_");
      const pattern = templateId.replace("template", "");

      const modal = new ModalBuilder()
        .setCustomId(`recruitModal_${commandName}_${pattern}`)
        .setTitle("募集設定")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("deadlineInput")
              .setLabel("締切日を入力 (YYYY-MM-DD)")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("例: 2025-09-20")
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("conditionInput")
              .setLabel("ゲーム条件を入力してください")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("例: レース条件/人数/予選日程")
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    }

    // 3. モーダル送信 → 募集メッセージ作成
    if (interaction.isModalSubmit() && interaction.customId.startsWith("recruitModal")) {
      const [_, commandName, pattern] = interaction.customId.split("_");

      const deadlineStr = interaction.fields.getTextInputValue("deadlineInput");
      const conditions = interaction.fields.getTextInputValue("conditionInput");

      const deadline = new Date(`${deadlineStr}T00:00:00+09:00`);
      if (isNaN(deadline.getTime())) {
        return interaction.reply({
          content: "⚠️ 日付形式が正しくありません。YYYY-MM-DDで入力してください。",
          ephemeral: true,
        });
      }

      const deadlineFmt = deadline.toISOString().slice(0, 10);

      const jpName = commandConfig[commandName].jpName;
      const templateText = commandConfig[commandName].templates[pattern];
      const imageUrl = commandConfig[commandName].image;

      const messageContent =
        `📢 ボス！　${jpName} の募集案内が来ました！\n\n${templateText}\n\n` +
        `締切日: ${deadlineFmt}\n\n🎮 レギュレーション\n${conditions}\n\n参加してくださるトレーナーの皆様は✅リアクションお願いします！`;

      const channel = await client.channels.fetch(interaction.channel.id);

      let sentMessage;
      if (imageUrl) {
        // 画像あり
        sentMessage = await channel.send({
          content: messageContent,
          files: [imageUrl],
        });
      } else {
        // 画像なし
        sentMessage = await channel.send(messageContent);
      }

      // 💡 募集メッセージにデフォルトでリアクション追加
      await sentMessage.react("✅");

      // タスク保存
      tasks[commandName] = {
        deadline,
        pattern,
        conditions,
        channelId: interaction.channel.id,
      };

      await interaction.reply({
        content: `✅ 募集メッセージを作成しました\n(締切: ${deadlineFmt}, 条件: ${conditions})`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// ==== リアクションによるロール付与（大会ごとにロール分け） ====
client.on("messageReactionAdd", async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;
  if (reaction.emoji.name !== "✅") return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const content = reaction.message.content || "";
  let roleName = null;

  if (content.includes("SDG's CUP")) {
    roleName = "SDGsカップ"; // SDGs CUP用ロール
  } else if (content.includes("えすあーる杯")) {
    roleName = "えすあーる杯"; // えすあーる杯用ロール
  }

  if (!roleName) return;

  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    console.warn(`⚠️ ロール「${roleName}」がサーバーに存在しません`);
    return;
  }

  const member = await guild.members.fetch(user.id);
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role);
    console.log(`✅ ${user.tag} にロール「${roleName}」を付与しました`);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;
  if (reaction.emoji.name !== "✅") return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const content = reaction.message.content || "";
  let roleName = null;

  if (content.includes("SDG's CUP")) {
    roleName = "SDGsカップ";
  } else if (content.includes("えすあーる杯")) {
    roleName = "えすあーる杯";
  }

  if (!roleName) return;

  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    console.warn(`⚠️ ロール「${roleName}」がサーバーに存在しません`);
    return;
  }

  const member = await guild.members.fetch(user.id);
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    console.log(`❌ ${user.tag} からロール「${roleName}」を削除しました`);
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
