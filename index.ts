import Axios from 'axios';

import { exec } from 'child_process';

import Config from './Config.json';

let LastRestartTime = 0;
let LastWebhookTime = 0;

const RESTART_COOLDOWN = 300000; // 5 minutes
const WEBHOOK_COOLDOWN = 5000; // 5 seconds

async function Log(Title: string, Message: string, Color: number = 0xbda4fc) {

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

                color: Color

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

function Restart(): Promise<boolean> {

    return new Promise((resolve, reject) => {

        exec("net stop KSPServer", (err, _stdout, stderr) => {

            if (err) { Log("Stop Server: Error", err.message); return resolve(false); } 
            if (stderr) { Log("Stop Server: Error", stderr); return resolve(false); }

        });

        setTimeout(() => {

            exec("net start KSPServer", (err, _stdout, stderr) => {

                if (err) { Log("Start Server: Error", err.message); return resolve(false); }
                if (stderr) { Log("Start Server: Error", stderr); return resolve(false); }

            });

            LastRestartTime = Date.now();

            resolve(true);

        }, 5000);

    });

}

let PreviousAmtOfPlayers: number = 0;
let LastRoutineLog: number = 0;

setInterval(async () => {

    const ServerInfo = await fetch(Config.InfoURL).then(res => res.json()).catch(err => console.error(err)) as ServerInfoResponse[] | undefined;

    const Server = (ServerInfo || [])[0];

    if (!ServerInfo || !Server) return;

    const Players = Server.CurrentState.CurrentPlayers;
    const MemoryUsed = Server.CurrentState.BytesUsed;

    if (PreviousAmtOfPlayers > 0 && Players.length === 0 && Date.now() - LastRestartTime > RESTART_COOLDOWN && MemoryUsed / (1024 ** 3) >= Config.RoutineRestartMemoryLimit) {

        PreviousAmtOfPlayers = 0;

        const Success = await Restart();
        
        if (Success) Log("Server Restart", `Restarted the server due to no players and high memory usage.`, 0xe87489);

        return;

    }

    PreviousAmtOfPlayers = Players.length;

    if (MemoryUsed / (1024 ** 3) > Config.MemoryLimitInGB && Date.now() - LastRestartTime > RESTART_COOLDOWN) {

        const Success = await Restart();

        if (Success) Log("Server Restart", `Restarted the server due to high memory usage.`, 0xe87489);
        
    }

    else if (MemoryUsed / (1024 ** 3) > Config.MemoryWarningThreshold) {

        Log("Memory Warning", `The server is using ${(MemoryUsed / (1024 ** 3)).toFixed(3)} GB of memory.`, 0xeaef7f);
        
    }

    else if (LastRoutineLog + Config.RoutineLoggingTime < Date.now()) {

        Log("Routine Log", `Server is using ${(MemoryUsed / (1024 ** 3)).toFixed(3)} GB of memory and has ${Players.length} ${Players.length === 1 ? "player" : "players"}.`);

        LastRoutineLog = Date.now();

    }

}, 30_000);