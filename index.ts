import Axios from 'axios';

import { exec } from 'child_process';

import Config from './Config.json';

let LastRestartTime = 0;
let LastWebhookTime = 0;

const RESTART_COOLDOWN = 300000; // 5 minutes
const WEBHOOK_COOLDOWN = 5000; // 5 seconds

async function Log(Title: string, Message: string) {

    console.log(`${Title.toUpperCase()} • ${Message}`);

    if (Date.now() < LastWebhookTime + WEBHOOK_COOLDOWN) return;

    LastWebhookTime = Date.now();

    Axios.post(Config.Webhook, {

        embeds: [

            {

                title: Title,
                description: Message,

                author: {

                    name: "Log Outputted",

                },

                footer: Config.EmbedFooter,

                color: 0xbda4fc

            }

        ]

    }).catch(err => console.error(err));

}

interface ServerInfoResponse {

    CurrentState: {

        CurrentPlayers: string[],
        BytesUsed: number;

    }  
    
}

let PreviousAmtOfPlayers: number = 0;
let LastRoutineLog: number = 0;

setInterval(async () => {

    const ServerInfo = await fetch(Config.InfoURL).then(res => res.json()).catch(err => console.error(err)) as ServerInfoResponse[] | undefined;

    if (!ServerInfo) return;

    const Server = ServerInfo[0];

    const Players = Server.CurrentState.CurrentPlayers;
    const MemoryUsed = Server.CurrentState.BytesUsed;

    if (PreviousAmtOfPlayers > 0 && Players.length === 0 && Date.now() - LastRestartTime > RESTART_COOLDOWN) {

        PreviousAmtOfPlayers = 0;

        exec("pm2 restart KSPServer", (err, _stdout, stderr) => {

            if (err) Log("Restart Server: Error", err.message);
            if (stderr) Log("Restart Server: Error", stderr);

            Log("Server Restart", `Routinely restarted the server due to player count.`);

        });

        return;

    }

    PreviousAmtOfPlayers = Players.length;

    if (MemoryUsed / (1024 ** 3) > Config.MemoryLimitInGB && Date.now() - LastRestartTime > RESTART_COOLDOWN) {

        exec("pm2 restart KSPServer", (err, _stdout, stderr) => {

            if (err) Log("Restart Server: Error", err.message);
            if (stderr) Log("Restart Server: Error", stderr);

            Log("Server Restart", `Restarted the server due to high memory usage.`);

        });

    }

    else if (MemoryUsed / (1024 ** 3) > Config.MemoryWarningThreshold) {

        Log("Memory Warning", `The server is using ${(MemoryUsed / (1024 ** 3)).toFixed(3)} GB of memory.`);
    }

    else if (LastRoutineLog + Config.RoutineLoggingTime < Date.now()) {

        Log("Routine Log", `Server is using ${(MemoryUsed / (1024 ** 3)).toFixed(3)}GB of memory and has ${Players.length} ${Players.length === 1 ? "player" : "players"}.`);

        LastRoutineLog = Date.now();

    }

}, 30_000);