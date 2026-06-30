import { spawn } from "node:child_process"
import { setTimeout } from "node:timers/promises";

import crypto from "node:crypto";

import PlayerHuntTable from "../vendor/player_hunts_table.json";
import MatchmakerHuntTable from "../vendor/matchmaker_hunts_table.json";
import { kill } from "node:process";

const RAMSGATE_MAP_PATH = "/Game/Maps/ramsgate/ramsgate_01_persistent";
const TRAINING_DOJO_MAP_PATH = "/Game/Maps/islands/dojo/training_dojo_persistent";

export type Gameserver = {
    id: string,
    port: number,
    map: string,
    behemoth: string | undefined,
    matchmakerHuntId: string | undefined,
    expectedPlayers: ExpectedPlayer[] | undefined,
    isRamsgate: boolean,
    isTrainingDojo: boolean,
    processId: number,
    startTime: Date
};

type ExpectedPlayer = {
    playerUid: string,
    playerHuntId: string
};

export let Gameservers: Gameserver[] = [];
let FreePorts: number[] = [];

let RamsgateServer : Gameserver;
let TrainingDojoServer : Gameserver;

const PORT_RANGE_BEGIN = Number(process.env.PORT_RANGE_BEGIN!);
const PORT_RANGE_END = Number(process.env.PORT_RANGE_END!);
const GAMESERVER_BINARY_PATH = process.env.GAMESERVER_BINARY_PATH!;
const STANDARD_GAMESERVER_ARGS = ["-EpicPortal", "-server", "-nullrhi"];
const METAGAME_API_KEY = process.env.METAGAME_API_KEY!;
const MY_IP = process.env.MY_IP!;

function TransformExpectedPlayerArgs(ExpectedPlayers: ExpectedPlayer[]){
    let ToReturn = "";

    for(const Player of ExpectedPlayers){
        ToReturn = ToReturn + Player.playerUid + ":" + Player.playerHuntId + ",";
    }

    if(ToReturn.length > 0){
        ToReturn = ToReturn.slice(0, -1); // Remove trailing ','
    }

    return ToReturn;
}

export async function CleanupServer(ServerToShutdown: Gameserver){
    FreePorts.push(ServerToShutdown.port);

    Gameservers = Gameservers.filter(Server => Server !== ServerToShutdown);
}

let ServerLaunchQueue: Promise<void> = Promise.resolve();

async function StartServer(Map: string, Behemoth: string | undefined, MatchmakerHuntId: string | undefined, ExpectedPlayers: ExpectedPlayer[] | undefined, IsRamsgate: boolean, IsTrainingDojo: boolean){
    const LaunchProc = ServerLaunchQueue;

    ServerLaunchQueue = ServerLaunchQueue.catch(() => {}).then(async () => await setTimeout(10 * 1000));

    await LaunchProc;
    
    const Port = FreePorts.pop();
    const Id = crypto.randomUUID();

    if(Port == undefined){
        throw new Error("No free ports left!");
    }

    const Child = spawn(GAMESERVER_BINARY_PATH, [
        METAGAME_API_KEY,
        Port.toString(),
        Map,
        Behemoth != undefined ? Behemoth : "NO_BEHEMOTH",
        MatchmakerHuntId != undefined ? MatchmakerHuntId : "NO_MM_HUNTID",
        ExpectedPlayers != undefined ? TransformExpectedPlayerArgs(ExpectedPlayers) : "NO_EXPECTED_PLAYERS",
        MY_IP + ":" + Port.toString(),
        ...STANDARD_GAMESERVER_ARGS
    ]);

    Child.unref();

    const NewGameserver: Gameserver = {
        id: Id,
        port: Port,
        map: Map,
        behemoth: Behemoth,
        matchmakerHuntId: MatchmakerHuntId,
        expectedPlayers: ExpectedPlayers,
        isRamsgate: IsRamsgate,
        isTrainingDojo: IsTrainingDojo,
        processId: Child.pid!,
        startTime: new Date()
    };

    Gameservers.push(NewGameserver);

    return NewGameserver;
}

export function GetRamsgateConnectionDetails(){
    return {
        host: MY_IP,
        port: RamsgateServer.port
    };
}

export function GetTrainingDojoConnectionDetails(){
    return {
        host: MY_IP,
        port: TrainingDojoServer.port
    };
}

export async function StartupGameserverWithArgs(GameArgs: string){
    const Map = GameArgs.split("?")[0];
    const Behemoth = GameArgs.split("?")[2].split("=")[1];

    const GameServerToReturn = await StartServer(Map, Behemoth, undefined, undefined, false, false);

    return {
        host: MY_IP,
        port: GameServerToReturn.port
    };
}

function GetMatchmakerHuntIdFromPlayerHuntId(PlayerHuntId: string): string{
    const MatchmakerHuntIDs = (PlayerHuntTable[0].Rows as any)[PlayerHuntId].MatchmakerHuntIDs;

    const MatchmakerHuntObject = MatchmakerHuntIDs[crypto.randomInt(0, MatchmakerHuntIDs.length)];

    return MatchmakerHuntObject.RowName;
}

function GetBehemothPathFromMatchmakerHuntId(MatchmakerHuntId: string): string{
    const MatchmakerHuntObject = (MatchmakerHuntTable[0].Rows as any)[MatchmakerHuntId];

    return MatchmakerHuntObject.SpecificBehemoth.BehemothAsset.AssetPathName;
}

function GetMapPathFromMatchmakerHuntId(MatchmakerHuntId: string): string{
    const MatchmakerHuntObject = (MatchmakerHuntTable[0].Rows as any)[MatchmakerHuntId];

    const MapList = MatchmakerHuntObject.MapList;

    return MapList[crypto.randomInt(0, MapList.length)].MapAssetName.split(".")[0];
}

export async function StartupGameserverWithHuntIdAndPlayers(HuntId: string, ExpectedPlayers: string[]){
    const MatchmakerHuntId = GetMatchmakerHuntIdFromPlayerHuntId(HuntId);
    const BehemothPath = GetBehemothPathFromMatchmakerHuntId(MatchmakerHuntId);
    const MapPath = GetMapPathFromMatchmakerHuntId(MatchmakerHuntId);

    const GameServerToReturn = await StartServer(MapPath, BehemothPath, MatchmakerHuntId, ExpectedPlayers.map((PlayerId) => {
        return {
            playerUid: PlayerId,
            playerHuntId: HuntId
        };
    }), false, false);

    return {
        host: MY_IP,
        port: GameServerToReturn.port
    }
}

export async function Startup(){
    for(let i = PORT_RANGE_BEGIN; i <= PORT_RANGE_END; i++){
        FreePorts.push(i);
    }

    RamsgateServer = await StartServer(RAMSGATE_MAP_PATH, undefined, undefined, undefined, true, false);

    TrainingDojoServer = await StartServer(TRAINING_DOJO_MAP_PATH, undefined, undefined, undefined, false, true);
}