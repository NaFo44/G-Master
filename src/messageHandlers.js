const TARGET_USER_ID = process.env.TARGET_USER_ID || "819527758501642290";
const gf1Pattern = /(j.?ai|gé?).?(faim|f1|la dalle)/i;
const images_bouffe = [
  "https://lelocalapizzas.fr/wp-content/uploads/2023/04/pizza-saumon-creme-fraiche-recette.jpg",
  "https://burgerkingfrance.twic.pics/custom-pages/2024/20241028_MastersPerennes/produit_1_1.png",
  "https://dxm.dam.savencia.com/api/wedia/dam/variation/fix635d9eidk9muu7yq33zuescmdts13b7bw94o/savencia_2000_webp",
  "https://marcwiner.com/wp-content/uploads/2024/09/brochettes-teriyaki-en-tete-750x563.jpg",
  "https://assets.afcdn.com/recipe/20211222/126196_w1024h768c1cx896cy845cxt0cyt0cxb2121cyb1414.jpg",
  "https://odelices.ouest-france.fr/images/recettes/2015/glace_au_chocolat-1024x1081.jpg",
  "https://blog.pourdebon.com/wp-content/uploads/2018/03/omelette-750x500.jpg",
  "https://www.tables-auberges.com/storage/uploads/2023/10/AdobeStock_478424723-2-1024x683.jpeg",
  "https://charcuteriepereanselme.fr/cdn/shop/products/IMG_6845.jpg",
  "https://img.cuisineaz.com/660x495/2015/10/29/i88809-raclette.webp",
  "https://assets.afcdn.com/recipe/20171218/76132_w1024h768c1cx1872cy2808cxt0cyt0cxb3744cyb5616.jpg",
  "https://mag.guydemarle.com/app/uploads/2025/04/cassoulet-1024x598.jpg",
  "https://www.lesfoodies.com/_recipeimage/118317/astuce-conserver-la-salade.jpg",
  "https://i0.wp.com/cuisinovores.com/wp-content/uploads/2024/10/photo_boeuf_bourguignon_cuisinovores.webp"
];

const messageFin = `# GMilgram - C'est la fin !
Ça y est ! Tu as terminé toutes les énigmes de la communauté !
Mais qui dit énigme dit Coffre... Que tu recevras par la Poste (cadeau, pas besoin de partir en pleine nuit avec une pelle...).
||@everyone||`;

const allowedChannels = [
  "1278672736910311465",
  "1299853826001469561",
  "1315805001603481660"
];

console.log("messageHandlers.js loaded");

export async function handleMessage(message) {
    if (message.author.bot) return;
    if (!allowedChannels.includes(message.channel.id)) return;
    let modified = false;
    let newMessage = message.content;
    
    const reactions = [
        { name: "myrtilles", emojis: "🫐" },
        { name: "sangliers", emojis: "🐗" }
    ];

    for (let i = 0; i < reactions.length; i++) {
        if (new RegExp(reactions[i].name, "i").test(newMessage)) {
            console.log(logsDateSeverity("I") + reactions[i].name + " : ajout d'une réaction");
            try {
                await message.react(reactions[i].emojis);
            } catch {
                console.log(logsDateSeverity("E") + reactions[i].name + " : impossible d'ajouter une réaction");
            }
        }
    }

    if (/oui oui bien sûr bien sûûûr/i.test(newMessage) && message.author.id === TARGET_USER_ID) {
        console.log(logsDateSeverity("I") + "Fin de chasse : envoi du message");
        try {
        await message.channel.send(messageFin);
        } catch {
        console.log(logsDateSeverity("E") + "Fin de chasse : impossible d'envoyer le message");
        }
    }

    // "gé" to "G"
    if (/gé/i.test(newMessage)) {
        console.log(logsDateSeverity("I") + "gé/G : remplacement d'au moins 1 occurence");
        newMessage = newMessage
            .replaceAll(/([^[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])?gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1-G-")
            .replaceAll(/gé(?![\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "G-")
            .replaceAll(/(^|[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"])gé(?=[\]\s.,\/#!$%\^&\*;:{}=\-_`~()'"]|$)/gi, "$1G")
            .replaceAll(/gé/gi, "-G");
        modified = true;
    }

    // "quantique" to "quan-tic tac" and link
    if (/quantique/i.test(newMessage)) {
        console.log(logsDateSeverity("I") + "Quantique/quan-tic tac : remplacement d'au moins 1 occurence");
        newMessage = newMessage.replace(/quantique/gi, "[quan-tic tac](https://www.youtube.com/watch?v=fmvqz0_KFX0)");
        modified = true;
    }

    if (modified) {
        console.log(logsDateSeverity("I") + "Message modifié : envoi du message");
        try {
            const sent = await message.channel.send(newMessage);
            setTimeout(() => sent.delete().catch(() => {}), 30_000);
        } catch {
            console.log(logsDateSeverity("E") + "Message modifié : impossible d'envoyer le message");
        }
    }

    // send food photos when "j'ai faim" is detected
    if (gf1Pattern.test(newMessage)) {
        const image_bouffe = images_bouffe[Math.floor(Math.random() * images_bouffe.length)];
        try {
            await message.reply(image_bouffe);
        } catch (err) {
            console.log(logsDateSeverity("E") + "Image de bouffe (nouveau message) : impossible d'envoyer l'image");
        }
    }
};

export async function handleMessageUpdate(oldMessage, newMessage) {
  if (newMessage.author.bot) return;
  if (!allowedChannels.includes(newMessage.channel.id)) return;
  if (oldMessage.content === newMessage.content) return;

  if (gf1Pattern.test(newMessage.content)) {
    const image_bouffe = images_bouffe[Math.floor(Math.random() * images_bouffe.length)];
    try {
      await newMessage.reply(image_bouffe);
    } catch (err) {
        console.log(logsDateSeverity("E") + "Image de bouffe (message modifié) : impossible d'envoyer l'image");
    }
  }
};

export async function messageReplyHandler(message) {
    if (message.author.bot) return;
    if (!allowedChannels.includes(message.channel.id)) return;

    const raw = message.content;
    const replies = [
        {name: "quoi/feur", pattern: /^.*quoi[ .!?]*$/i, response: "feur."},
        {name: "oui/stiti", pattern: /^.*oui[ .!?]*$/i, response: "stiti."},
        {name: "non/bril", pattern: /^.*non[ .!?]*$/i, response: "bril."},
        {name: "bonne nuit/Medbed activé !", pattern: /^.*bonne nuit.*$/i, response: "Medbed activé !"}
    ];

    for (let i = 0; i < replies.length; i++) {
        if (replies[i].pattern.test(raw)) {
            console.log(logsDateSeverity("I") + replies[i].name + " : envoi d'une réponse");
            try {
                await message.channel.send(replies[i].response);
            } catch {
                console.log(logsDateSeverity("E") + replies[i].name + " : impossible d'envoyer la réponse");
            }
        }
    }
};