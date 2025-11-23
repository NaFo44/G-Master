import {
  loadScores,
  saveScores,
  loadUsedContents,
  saveUsedContents,
  getGuild,
  countAbsentPoints,
  purgeAbsentScores
} from "./src/utils.js";

const LYLITT_USER_ID = process.env.LYLITT_USER_ID || "460073251352346624";
const replyCounts = {};    // to count replies per game
const usedContents = {};   // store already used contents

let scores = {};
let activeMessageId = null;
let initialAuthorId = null;

export default async function initGame(message){
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

  // rank handling
  if (content === '.rank') {
    loadScores();
    loadUsedContents();
    console.log(logsDateSeverity("I") + "Lylitt Game : demande d'affichage du classement");

    try {
      await message.delete();
      console.log(logsDateSeverity("I") + "Lylitt Game : message \".rank\" envoyé supprimé");
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(logsDateSeverity("E") + "Lylitt Game : impossible de supprimer le message demandant l'affichage du rank");
    }

    if (Object.keys(scores).length === 0) {
      return await message.channel.send("Aucun score pour l’instant.");
    }

    const entries = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);

    const lines = entries.map(([userId, score], i) => {
      return `${i + 1}. <@${userId}> : ${score} point${score !== 1 ? 's' : ''}`;
    });

    const sent = await message.channel.send('Préparation du classement...');
    setTimeout(async () => {
        try {
            await sent.edit('**🏆 Classement :**\n' + lines.join('\n'));
            console.log(logsDateSeverity('I') + "Lylitt Game : message de classement édité (top total) après 1s");
            setTimeout(async () => {
                try {
                    await sent.edit('**🏆 Classement (top 5) :**\n' + lines.slice(0, 5).join('\n'));
                    console.log(logsDateSeverity('I') + "Lylitt Game : message de classement édité (top 5) après 30s");
                } catch (err) {
                    console.log(logsDateSeverity('E') + "Lylitt Game : échec de l’édition du message de classement (top 5)");
                }
            }, 30_000);
        } catch (err) {
        console.log(logsDateSeverity('E') + "Lylitt Game : échec de l’édition du message de classement (top total)");
      }
    }, 1_000);
  }

  // detect and launch Lylitt Game
  if (message.author.id === LYLITT_USER_ID && content.includes("bouh") && !message.reference) {
    loadScores();
    loadUsedContents();
    activeMessageId = message.id;
    initialAuthorId = message.author.id;
    replyCounts[activeMessageId] = 0;
    usedContents[activeMessageId] = new Set();
    console.log(logsDateSeverity("I") + "Lylitt Game : lancement d'une partie après détection d'un \"BOUH\"");
    return await message.channel.send("👻 Partie lancée ! Répondez au `BOUH` initial.");
  }

  // process the first three replies
  if (activeMessageId && message.author.id !== initialAuthorId && message.reference?.messageId === activeMessageId && replyCounts[activeMessageId] < 3) {
    loadScores();
    loadUsedContents();
    console.log(logsDateSeverity("I") + "Lylitt Game : analyse d'une réponse (" + (replyCounts[activeMessageId] + 1) + "/3)");
    const replyContent = content.trim();
    const userId = message.author.id;

    if (usedContents[activeMessageId].has(replyContent)) {
      scores[userId] = (scores[userId] || 0) - 1;
      console.log(logsDateSeverity("I") + "Lylitt Game : envoi de la réaction à une réponse déjà postée");
      try {
        await message.react("❌");
        await message.react("🇩");
        await message.react("🇪");
        await message.react("🇯");
        await message.react("🇦");
        await message.react("▪️");
        await message.react("🇵");
        await message.react("🇴");
        await message.react("🇸");
        await message.react("🇹");
        await message.react("3️⃣");
      } catch (error) {
        console.log(logsDateSeverity("E") + "Lylitt Game : impossible d'envoyer la réaction à une réponse déjà postée : " + error + "\"");
      }
    } else {
      usedContents[activeMessageId].add(replyContent);
      saveUsedContents();
      scores[userId] = (scores[userId] || 0) + 1;
      console.log(logsDateSeverity("I") + "Lylitt Game : envoi de la réaction à une réponse validée");
      try {
        await message.react("✅");
      } catch (error) {
        console.log(logsDateSeverity("E") + "Lylitt Game : impossible d'envoyer la réaction à une réponse validée : " + error + "\"");
      }
      replyCounts[activeMessageId]++;
      saveScores();
    }
    return;
  }

  // redistribution handling
  if (message.author.id === LYLITT_USER_ID && content.includes("grrr") && !message.reference && !message.author.bot) {
    loadScores();
    const guild = await getGuild();
    const points = await countAbsentPoints(guild);

    if (points === 0) {
      console.log(logsDateSeverity("I") + "Lylitt Game (redistribution) : annulation du lancement après détection d'un \"Grrr\" (aucun point à redistribuer)");
      return await message.react("❌");
    } else {
      console.log(logsDateSeverity("I") + "Lylitt Game (redistribution) : lancement après détection d'un \"Grrr\" (" + points + " point" + (points > 1 ? 's' : '') + " à redistribuer)");
      return await message.reply("*" + points + "point" + (points > 1 ? 's' : '') + " à redistribuer :clock1230:*");
    }
  }
  
  if (message.author.id !== LYLITT_USER_ID && message.reference && !message.author.bot) {
    loadScores();
    const guild = await getGuild();
    const points = await countAbsentPoints(guild);

    if (points <= 0) {
      await message.react('❌');
      return;
    }

    const original = await message.channel.messages.fetch(message.reference.messageId);
    if (original.author.id !== LYLITT_USER_ID || !original.content.toLowerCase().includes('grrr')) return;
    const diffSec = Math.floor((Date.now() - original.createdTimestamp) / 1000);

    if (points - diffSec + 1 > 0) {
      const pointsWon = points - diffSec + 1;
      const winnerId = message.author.id;
      console.log(logsDateSeverity("I") + "Lylitt Game (redistribution) : " + winnerId + " vient de gagner " + pointsWon + " points");
      scores[winnerId] = (scores[winerId] || 0) + pointsWon;
      saveScores();
      purgeAbsentScores(guild);
      return await message.reply("**Bien joué, tu viens de gagner " + pointsWon + " point" + (pointsWon > 1 ? 's' : '') + " ! :clap:**");
    } else {
      await message.react('❌');
    }
  }
}