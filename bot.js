require('./keep_alive');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.once('ready', async () => {
  console.log(`Bot ready: ${client.user.tag}`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);
  joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });
});

client.on('voiceStateUpdate', (oldState) => {
  if (oldState.member.id === client.user.id && !oldState.channelId) {
    setTimeout(() => client.emit('ready'), 5000);
  }
});

client.login(process.env.BOT_TOKEN);
