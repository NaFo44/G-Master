const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const app = express();


// Écouter sur un port spécifique
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
