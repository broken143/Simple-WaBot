const {
    default: makeWASocket,
    makeInMemoryStore,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const pretty = require('pino-pretty');
const fs = require('fs');

const stream = pretty({
    colorize: true
});

const logger = pino({ level: 'trace' }, stream);
const store = makeInMemoryStore({ logger: pino().child({ level: 'fatal', stream: 'store' }) });

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('session', pino({ level: 'fatal' }));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        logger: pino({
            level: 'fatal'
        }),
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({
                level: 'fatal'
            }))
        },
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 0,
        markOnlineOnConnect: true,
        getMessage: async (key) => (
            store.loadMessage((key.remoteJid), key.id) || 
            store.loadMessage((key.id)) || 
            {}).message || { conversation: null }
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', await saveCreds);

    sock.ev.on('messages.upsert', async (upsert) => {
        let message = upsert.messages[0];
        try {
            console.log(message);
            if (message.message.conversation === '/alive') {
                await sock.sendMessage(message.key.remoteJid, { text: 'Hello there!' });
            }
        } catch (e) {
            console.error(e);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { lastDisconnect, connection } = update;

        if (update.qr != 0 && update.qr != undefined) {
            logger.info('Escanea el QR, expira en 60 segundos.');
        }

        if (connection === 'connecting') {
            logger.info('🕓 Conectando..');
        }

        if (connection === 'open') {
            logger.info('✅ Conectado');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error instanceof Boom 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut 
                : true;
            if (shouldReconnect) {
                startSock();
            } else {
                logger.error('🔌 Desconectado');
            }
            logger.error(update);
        }
    });

    return sock;
}

startSock()
    .catch(e => console.log(e));
