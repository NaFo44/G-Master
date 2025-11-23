import fs from 'fs';

const { GUILD_ID } = process.env;
const USED_CONTENTS_FILE = process.env.USED_CONTENTS_FILE || "used_contents.json";

export function logsDateSeverity(severityCode) {
    let severity;
    switch (severityCode) {
        case 'C':
            severity = 'CRT';
            break;
        case 'E':
            severity = 'ERR';
            break;
        case 'W':
            severity = 'WRN';
            break;
        case 'I':
            severity = 'INF';
            break;
        case 'D':
            severity = 'DBG';
            break;
        default:
            severity = 'UNK';
    }

    const currentDateTime = new Date();

    // format date and time for the Paris timezone
    const options = {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    const parts = formatter.formatToParts(currentDateTime);

    // extract date parts
    let year, month, day, hour, minute, second;
    parts.forEach(part => {
        switch (part.type) {
            case 'year': year = part.value; break;
            case 'month': month = part.value; break;
            case 'day': day = part.value; break;
            case 'hour': hour = part.value; break;
            case 'minute': minute = part.value; break;
            case 'second': second = part.value; break;
        }
    });
    return `[${year}-${month}-${day} ${hour}:${minute}:${second}]\t${severity}\t`;
}

// loading already sent responses
export function loadUsedContents() {
  if (fs.existsSync(USED_CONTENTS_FILE)) {
    const raw = fs.readFileSync(USED_CONTENTS_FILE);
    const data = JSON.parse(raw);
    Object.keys(data).forEach(key => {
      usedContents[key] = new Set(data[key]);
    });
    console.log(logsDateSeverity("I") + "Lylitt Game : chargement des réponses déjà envoyées");
  }
}
// saving already sent responses
export function saveUsedContents() {
  fs.writeFileSync(USED_CONTENTS_FILE, JSON.stringify(usedContents, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }), null, 2);
  console.log(logsDateSeverity("I") + "Lylitt Game : sauvegarde des réponses déjà envoyées");
}

// returns an instance of discord.js Guild
export async function getGuild() {
  const guild = await client.guilds.fetch(GUILD_ID);
  return guild;
}

export async function fetchAllMemberIds(guild) {
  const members = await guild.members.fetch()
  console.log(logsDateSeverity("I") + "Lylitt Game (redistribution) : " + members.size + " membres trouvés sur le serveur");
  return [...members.keys()]
}