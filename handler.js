const { plugins } = require('./lib/plugins.js');
const { owner, prefixList } = require('./setting.js');
const { decodeJid } = require('./lib/func.js');
const { printLog } = require('./lib/print.js');
const db = require('./lib/database.js');

const handler = async (msg, sock) => {
    try {
        const prefixRegex = new RegExp(
            '^(' +
            prefixList.filter(Boolean)
                .map(c => c.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"))
                .join('|') +
            ')'
        );

        const match = msg.text.match(prefixRegex);
        const prefix = match ? match[0] : '';
        const trimText = msg.text.slice(prefix.length).trim();
        const [command, ...args] = trimText.split(/\s+/).map(x => x.toLowerCase());
        const text = trimText.replace(new RegExp(`^${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '').trim();

        const isGroup = msg.from.endsWith('@g.us');
        const isPrivate = msg.from.endsWith('@s.whatsapp.net');
        const isBroadcast = msg.from === 'status@broadcast';
        const isOwner = [sock.user.jid, ...owner.map(([number]) => number.replace(/[^0-9]/g, '') + '@s.whatsapp.net')].includes(msg.sender);
        const isRegistered = db.users.exist(msg.sender);
        const isBaileys = msg.id.startsWith('3EB0');

        const groupMetadata = isGroup ? await sock.groupMetadata(msg.from) : {};
        const groupName = groupMetadata.subject || '';
        const participants = groupMetadata.participants || [];

        const user = isGroup ? participants.find(u => decodeJid(u.id) === msg.sender) : {};
        const bot = isGroup ? participants.find(b => decodeJid(b.id) === sock.user.jid) : {};
        const isSuperAdmin = user?.admin === 'superadmin' || false;
        const isAdmin = isSuperAdmin || user?.admin === 'admin' || false;
        const isBotAdmin = bot?.admin === 'admin' || false;

        let isCommand = false;

        if (!db.groups.exist(msg.from) && isGroup) {
            await db.groups.add(msg.from);
            await db.save();
        }
        
        if (db.groups.exist(msg.from) && isRegistered) {
            const group = db.groups.get(msg.from)
            await group.users.add(msg.sender);
            await db.save();
        }

        const config = db.settings.get(sock.user.jid);
        if (config.mode === 'public' || (config.mode === 'self' && isOwner)) {
            for (const before of plugins.befores) {
                const name = Object.keys(before)[0];
                try {
                    await before[name].start({
                        msg, sock, text, args, status,
                        isGroup, isPrivate, isBroadcast, isOwner, isRegistered, isSuperAdmin, isAdmin, isBotAdmin, isBaileys,
                        groupMetadata, groupName, participants, db, plugins
                    });
                } catch (e) {
                    console.error(e);
                    if (e.name) {
                        if (before[name].setting?.error_react) await msg.react('❌');
                        await msg.reply(`*${e.name}* : ${e.message}`);
                    }
                }
            }

            if (!isBaileys || !isBroadcast) {
                const stickerCommand = (msg.type === 'stickerMessage' ?
                    db.stickers.get(Buffer.from(message[msg.type].fileSha256).toString('base64'))?.command :
                    ''
                );

                const commands = plugins.commands
                    .map(plugin => Object.values(plugin)[0])
                    .filter(commandObj => commandObj.command.some(cmd =>
                        cmd.toLowerCase() === stickerCommand || cmd.toLowerCase() === command
                    ));

                if (commands.length > 0) {
                    isCommand = true;

                    for (const cmd of commands) {
                        const setting = {
                            isRegister: false,
                            isGroup: false,
                            isPrivate: false,
                            isOwner: false,
                            isSuperAdmin: false,
                            isAdmin: false,
                            isBotAdmin: false,
                            ...cmd.setting
                        };

                        if (setting.isRegister && !isRegistered) {
                            await status({ type: 'isRegister', msg, prefix });
                            continue;
                        }
                        if (setting.isGroup && !isGroup) {
                            await status({ type: 'isGroup', msg });
                            continue;
                        }
                        if (setting.isPrivate && !isPrivate) {
                            await status({ type: 'isPrivate', msg });
                            continue;
                        }
                        if (setting.isOwner && !isOwner) {
                            await status({ type: 'isOwner', msg });
                            continue;
                        }
                        if (setting.isAdmin && !isAdmin) {
                            await status({ type: 'isAdmin', msg });
                            continue;
                        }
                        if (setting.isBotAdmin && !isBotAdmin) {
                            await status({ type: 'isBotAdmin', msg });
                            continue;
                        }

                        try {
                            await cmd.start({
                                msg, sock, text, args, prefix, command, status,
                                isGroup, isPrivate, isOwner, isRegistered, isSuperAdmin, isAdmin, isBotAdmin,
                                groupMetadata, groupName, participants, db, plugins
                            });
                        } catch (e) {
                            console.error(e);
                            if (e.name) {
                                if (cmd.setting?.error_react) await msg.react('❌');
                                await msg.reply(`*${e.name}* : ${e.message}`);
                            }
                        }
                    }
                }
            }
        }

        await printLog({ msg, sock, args, command, groupName, isGroup, isCommand });
    } catch (e) {
        console.error(e);
    }
};

const status = ({ type, msg, prefix: _p = '' }) => {
    const texts = {
        isRegister: `*🚩 Para utilizar este comando, debe estar registrado en la base de datos.*\n\n*🍟 Ejem. de Uso* ;\n\n1. ${_p}reg < username >\n2. ${_p}reg Andrés_74`,
        isOwner: '*🚩 Este comando está reservado únicamente para el creador del bot.*',
        isGroup: '*🚩 Este comando está disponible únicamente para su uso en grupos.*',
        isPrivate: '*🚩 Este comando está disponible únicamente para su uso en mi chat privado.*',
        isAdmin: '*🚩 Este comando está disponible únicamente para su uso por administradores del grupo.*',
        isBotAdmin: '*🚩 Para ejecutar este comando, debo tener permisos de administrador.*'
    };

    const text = texts[type];
    if (text) return msg.reply(text);
};

module.exports = handler;