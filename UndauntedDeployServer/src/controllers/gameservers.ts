import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import dgram from "node:dgram";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";

import crypto from "node:crypto";

import PlayerHuntTable from "../vendor/player_hunts_table.json";
import MatchmakerHuntTable from "../vendor/matchmaker_hunts_table.json";
import TrialsHardHuntTable from "../vendor/trials_hard_table.json";
import TrialsEliteHuntTable from "../vendor/trials_elite_table.json";
import { logger } from "../logger";
import { kill } from "node:process";

const RAMSGATE_MAP_PATH = "/Game/Maps/ramsgate/ramsgate_01_persistent";
const TRAINING_DOJO_MAP_PATH = "/Game/Maps/islands/dojo/training_dojo_persistent";
const TRIALS_MAP_PATH = "/Game/Maps/islands/arenas/arena_ramsgate_00";
const GAMESERVER_PORT_RELEASE_TIMEOUT_MS = Number(process.env.GAMESERVER_PORT_RELEASE_TIMEOUT_MS || "5000");

class NoFreeHuntPortsError extends Error {
    constructor(){
        super("No free ports left!");
        this.name = "NoFreeHuntPortsError";
    }
}

export type Gameserver = {
    id: string,
    port: number,
    map: string,
    behemoth: string | undefined,
    matchmakerHuntId: string | undefined,
    expectedPlayers: ExpectedPlayer[] | undefined,
    isRamsgate: boolean,
    isTrainingDojo: boolean,
    origin: GameserverOrigin,
    trigger: string,
    processId: number,
    startTime: Date,
    lastTouchedTime: Date,
    callbackToken: string | undefined,
    lastLifecycleHeartbeatTime: Date | undefined,
    reportedLiveConnections: number | undefined,
    reportedRawConnections: number | undefined,
    hadLiveConnection: boolean,
    lifecycleRetirement: LifecycleRetirementState,
    shutdownAfterSeconds: number | undefined,
    expectedShutdownReason: string | undefined,
    optimization: GameserverOptimizationMetrics | undefined,
    dllSha256: string | undefined,
    profiling: GameserverProfilingStatus | undefined,
    pacing: GameserverPacingStatus | undefined
};

type ExpectedPlayer = {
    playerUid: string,
    playerHuntId: string
};

type GameserverOptimizationMetrics = {
    mode: "off" | "report" | "safe" | "aggressive",
    safetyGate: "not_required" | "passed" | "initial_load" | "connections_present" | "timeout" | "signature_mismatch" | "failed",
    signatureValid: boolean,
    candidates: number,
    collected: number,
    retained: number,
    textures: number,
    materials: number,
    sounds: number,
    mapPackageCandidates: number,
    activeMapPackages: number,
    inactiveMapPackages: number,
    durationMs: number,
    workingSetBefore: number,
    workingSetAfter: number,
    privateBytesBefore: number,
    privateBytesAfter: number,
    configuredMaxFps: number,
    observedMaxFps: number,
    capSignatureValid: boolean,
    capResolved: boolean,
    capApplied: boolean,
    capVerified: boolean,
    preReadyNetworkingPasses: number,
    netServerMaxTickRate: number,
    maxNetTickRate: number,
    bootstrapMinimumMilliseconds: number,
    bootstrapMaximumMilliseconds: number,
    considerCacheMaxAgeMilliseconds: number,
    profilingEnabled: boolean,
    failed: boolean,
    error?: string
};

type GameserverReadyPayload = {
    id: string,
    port: number,
    pid: number,
    ready?: boolean,
    error?: string,
    optimization?: GameserverOptimizationMetrics,
    profiling?: GameserverProfilingStatus,
    pacing?: GameserverPacingStatus
};

type LifecycleRetirementState = {
    protocolVersion: number | undefined,
    heartbeatSequence: number | undefined,
    observationSequence: number | undefined,
    worldEpoch: number | undefined,
    zeroHeartbeatStreak: number,
    zeroSinceTime: Date | undefined,
    armedHeartbeatSequence: number | undefined
};

type GameserverHeartbeatPayload = {
    id: string,
    port: number,
    pid: number,
    liveConnections: number,
    rawConnections: number,
    protocolVersion?: number,
    heartbeatSequence?: number,
    observationSequence?: number,
    worldEpoch?: number
};

type GameserverPacingStatus = {
    state: "disabled" | "observing" | "active" | "fallback" | "unknown",
    installFailure: string,
    fallbackReason: string,
    executableBuildValid: boolean,
    signaturesValid: boolean,
    hookEnabled: boolean,
    highResolutionApiAvailable: boolean,
    timerCreated: boolean,
    correctionEverActivated: boolean,
    observedFrames: number,
    cvarMaxFps: number,
    cachedMaxFps: number,
    virtualMaxFps: number,
    rollingMedianCadenceHz: number,
    rollingMedianCoarseOvershootMs: number
};

type GameserverProfilingStatus = {
    enabled: boolean,
    started: boolean,
    startupWriteSucceeded: boolean,
    writerStarted: boolean,
    path: string,
    startupBytes: number,
    startupError: number,
    writerError: number,
    intervalBytes: number,
    intervalWriteFailures: number,
    lastIntervalError: number,
    dllSha256: string
};

type PendingGameserverReady = {
    port: number,
    token: string,
    expectedDllSha256: string,
    resolve: (Payload: GameserverReadyPayload) => void,
    reject: (Reason: Error) => void
};

type StartedGameserverProcess = {
    processId: number,
    child: ChildProcess | undefined
};

export type GameserverOrigin = "RAMSGATE_LAZY" | "TRAINING_DOJO_PREWARM" | "TRAINING_DOJO_LAZY" | "HUNT_ARGS" | "HUNT_MATCHMAKER";

type ProcessExitInfo = {
    code: number | null,
    signal: NodeJS.Signals | null
};

export let Gameservers: Gameserver[] = [];
let FreePorts: number[] = [];
const PendingGameserverReadyById = new Map<string, PendingGameserverReady>();
const PlayerServerAssignments = new Map<string, Gameserver>();
const PlayerToServerId = new Map<string, string>();
const ServerToPlayers = new Map<string, Set<string>>();

export type ShutdownReasonCode = "none" | "idle" | "neverConnected" | "escalation";
export interface GameserverIdleDecision {
    code: ShutdownReasonCode,
    serverId: string,
    reason: string,
    idleSeconds: number,
    zeroHeartbeatStreak: number
}

function RemovePlayerAssignment(PlayerId: string){
    const ServerId = PlayerToServerId.get(PlayerId);
    PlayerToServerId.delete(PlayerId);
    const Server = PlayerServerAssignments.get(PlayerId);
    PlayerServerAssignments.delete(PlayerId);
    if(ServerId != undefined){
        const Players = ServerToPlayers.get(ServerId);
        Players?.delete(PlayerId);
        if(Players != undefined && Players.size === 0)
            ServerToPlayers.delete(ServerId);
    }
    return Server;
}

function AddPlayerAssignment(PlayerId: string, Server: Gameserver){
    const Previous = PlayerServerAssignments.get(PlayerId);
    if(Previous != undefined && Previous !== Server)
        ServerToPlayers.get(Previous.id)?.delete(PlayerId);
    PlayerServerAssignments.set(PlayerId, Server);
    PlayerToServerId.set(PlayerId, Server.id);
    let Players = ServerToPlayers.get(Server.id);
    if(Players == undefined){
        Players = new Set<string>();
        ServerToPlayers.set(Server.id, Players);
    }
    Players.add(PlayerId);
}

let RamsgateServer : Gameserver | undefined;
let TrainingDojoServer : Gameserver | undefined;
let TrainingDojoStartup: Promise<Gameserver> | undefined;
let RamsgateStartup: Promise<Gameserver> | undefined;
let RamsgateShutdown: Promise<void> | undefined;

function CreateLifecycleRetirementState(): LifecycleRetirementState {
    return {
        protocolVersion: undefined,
        heartbeatSequence: undefined,
        observationSequence: undefined,
        worldEpoch: undefined,
        zeroHeartbeatStreak: 0,
        zeroSinceTime: undefined,
        armedHeartbeatSequence: undefined
    };
}

function CancelLifecycleRetirement(Server: Gameserver, Reason: string){
    const State = Server.lifecycleRetirement;
    if(State.zeroHeartbeatStreak > 0 || State.armedHeartbeatSequence != undefined){
        logger.debug({
            serverId: Server.id,
            port: Server.port,
            reason: Reason,
            zeroHeartbeatStreak: State.zeroHeartbeatStreak,
            armedHeartbeatSequence: State.armedHeartbeatSequence
        }, "Cancelled gameserver idle-retirement evidence");
    }
    State.zeroHeartbeatStreak = 0;
    State.zeroSinceTime = undefined;
    State.armedHeartbeatSequence = undefined;
}

function TouchGameserver(Server: Gameserver, Now = new Date()){
    Server.lastTouchedTime = Now;
    CancelLifecycleRetirement(Server, "activity_touch");
}

function AssignPlayersToServer(Server: Gameserver, Players: ExpectedPlayer[]){
    if(Players.length === 0)
        return;

    const PlayerIds = new Set(Players.map((Player) => Player.playerUid));
    const PreviousServers = new Set<Gameserver>();

    for(const Player of Players){
        const Previous = PlayerServerAssignments.get(Player.playerUid);
        if(Previous != undefined && Previous !== Server){
            PreviousServers.add(Previous);
            Previous.expectedPlayers = Previous.expectedPlayers?.filter(
                (Existing) => Existing.playerUid !== Player.playerUid);
        }
        AddPlayerAssignment(Player.playerUid, Server);
    }

    const Existing = new Set(
        (Server.expectedPlayers ?? []).map((Player) => Player.playerUid));
    Server.expectedPlayers ??= [];
    for(const Player of Players){
        if(!Existing.has(Player.playerUid)){
            Server.expectedPlayers.push(Player);
            Existing.add(Player.playerUid);
        }
    }

    logger.info({
        serverId: Server.id,
        port: Server.port,
        origin: Server.origin,
        playerIds: [...PlayerIds],
        previousServers: [...PreviousServers].map((Previous) => ({
            id: Previous.id,
            port: Previous.port,
            processId: Previous.processId
        }))
    }, "Updated authoritative player gameserver assignments");
}

const PORT_RANGE_BEGIN = Number(process.env.PORT_RANGE_BEGIN!);
const PORT_RANGE_END = Number(process.env.PORT_RANGE_END!);
const RAMSGATE_PORT = PORT_RANGE_END;
const TRAINING_DOJO_PORT = PORT_RANGE_END - 1;
const GAMESERVER_BINARY_PATH = process.env.GAMESERVER_BINARY_PATH!.replace(/^"|"$/g, "");
const GAMESERVER_DLL_PATH = join(dirname(GAMESERVER_BINARY_PATH), "UndauntedInternalServer.dll");
const STANDARD_GAMESERVER_ARGS = ["-EpicPortal", "-server", "-nullrhi"];
const METAGAME_API_KEY = process.env.METAGAME_API_KEY!;
const MY_IP = process.env.MY_IP!;
const DEPLOYSERVER_PORT = process.env.PORT!;
const GAMESERVER_READY_CALLBACK_URL = process.env.GAMESERVER_READY_CALLBACK_URL || `http://127.0.0.1:${DEPLOYSERVER_PORT}/api/gameservers/ready`;
const GAMESERVER_LIFECYCLE_CALLBACK_URL = `http://127.0.0.1:${DEPLOYSERVER_PORT}/api/gameservers/heartbeat`;
const SECONDS_TO_WAIT_BETWEEN_GAMESERVER_STARTUP = Number(process.env.SECONDS_TO_WAIT_BETWEEN_GAMESERVER_STARTUP!);
const GAMESERVER_STARTUP_TIMEOUT_SECONDS = Number(process.env.GAMESERVER_STARTUP_TIMEOUT_SECONDS || "60");
const ADOPT_GAMESERVER = process.env.ADOPT_GAMESERVER !== "false";
const RAMSGATE_IDLE_SHUTDOWN_SECONDS = ParseBoundedIntegerEnvironment(
    "RAMSGATE_IDLE_SHUTDOWN_SECONDS", 10, 0, 86400);
const LIFECYCLE_PROTOCOL_VERSION = 2;
const LIFECYCLE_HEARTBEAT_STALE_SECONDS = 7.5;
const LIFECYCLE_MINIMUM_ZERO_HEARTBEATS = 3;
const NEVER_CONNECTED_IDLE_GRACE_SECONDS = 90;
const PREWARM_TRAINING_DOJO = process.env.PREWARM_TRAINING_DOJO === "true";
const TRAINING_DOJO_IDLE_SHUTDOWN_SECONDS = Number(process.env.TRAINING_DOJO_IDLE_SHUTDOWN_SECONDS || "300");
const HUNT_IDLE_SHUTDOWN_SECONDS = Number(process.env.HUNT_IDLE_SHUTDOWN_SECONDS || "90");
const ESCALATION_IDLE_SHUTDOWN_SECONDS = ParseBoundedIntegerEnvironment(
    "ESCALATION_IDLE_SHUTDOWN_SECONDS", 30, 0, 86400);
const GAMESERVER_CONSOLE_LOG = process.env.GAMESERVER_CONSOLE_LOG === "true";
const GAMESERVER_ASSET_STRIPPING_MODE = ParseAssetStrippingMode(process.env.GAMESERVER_ASSET_STRIPPING_MODE);
const GAMESERVER_STRIP_INACTIVE_MAP_PACKAGES = ParseBooleanEnvironment("GAMESERVER_STRIP_INACTIVE_MAP_PACKAGES", true);
const GAMESERVER_ASSET_STRIPPING_LOG_DETAILS = ParseBooleanEnvironment("GAMESERVER_ASSET_STRIPPING_LOG_DETAILS", false);
const GAMESERVER_ASSET_GC_WAIT_SECONDS = ParseBoundedIntegerEnvironment("GAMESERVER_ASSET_GC_WAIT_SECONDS", 15, 1, 15);
const GAMESERVER_PROFILING = ParseBooleanEnvironment("GAMESERVER_PROFILING", false);
const GAMESERVER_PROFILE_INTERVAL_SECONDS = ParseBoundedIntegerEnvironment("GAMESERVER_PROFILE_INTERVAL_SECONDS", 30, 10, 3600);
const GAMESERVER_CONSIDER_CACHE_MAX_AGE_MS = ParseBoundedIntegerEnvironment(
    "GAMESERVER_CONSIDER_CACHE_MAX_AGE_MS", 250, 50, 5000);

function ParseBooleanEnvironment(Name: string, Fallback: boolean){
    const RawValue = process.env[Name];

    if(RawValue == undefined || RawValue.trim().length === 0){
        return Fallback;
    }

    if(RawValue === "true" || RawValue === "1"){
        return true;
    }

    if(RawValue === "false" || RawValue === "0"){
        return false;
    }

    logger.warn({name: Name, value: RawValue, fallback: Fallback}, "Invalid boolean gameserver configuration; using fallback");
    return Fallback;
}

function ParseBoundedIntegerEnvironment(Name: string, Fallback: number, Minimum: number, Maximum: number){
    const RawValue = process.env[Name];
    const ParsedValue = Number(RawValue);

    if(RawValue == undefined || RawValue.trim().length === 0 || !Number.isInteger(ParsedValue) || ParsedValue < Minimum || ParsedValue > Maximum){
        if(RawValue != undefined && RawValue.trim().length > 0){
            logger.warn({name: Name, value: RawValue, minimum: Minimum, maximum: Maximum, fallback: Fallback}, "Invalid numeric gameserver configuration; using fallback");
        }
        return Fallback;
    }

    return ParsedValue;
}

function ParseAssetStrippingMode(Value: string | undefined): GameserverOptimizationMetrics["mode"]{
    if(Value === "off" || Value === "report" || Value === "safe" || Value === "aggressive"){
        return Value;
    }

    if(Value != undefined && Value.trim().length > 0){
        logger.warn({value: Value, fallback: "aggressive"}, "Invalid asset stripping mode; using fallback");
    }

    return "aggressive";
}

function IsEscalationServer(HuntId: string | undefined, MatchmakerHuntId: string | undefined, MapPath: string | undefined){
    return [HuntId, MatchmakerHuntId, MapPath]
        .some((Value) => Value?.toLowerCase().includes("escalation"));
}

function GetHuntIdleShutdownSeconds(HuntId: string | undefined, MatchmakerHuntId: string | undefined, MapPath: string | undefined){
    if(IsEscalationServer(HuntId, MatchmakerHuntId, MapPath)){
        return ESCALATION_IDLE_SHUTDOWN_SECONDS;
    }

    return HUNT_IDLE_SHUTDOWN_SECONDS;
}

function FormatHex32(Value: number){
    return `0x${(Value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function ToSigned32(Value: number){
    return Value > 0x7FFFFFFF ? Value - 0x100000000 : Value;
}

function DescribeWindowsExitCode(Code: number | null){
    if(Code == undefined){
        return "code=null";
    }

    const UnsignedCode = Code >>> 0;
    const SignedCode = ToSigned32(UnsignedCode);
    const KnownStatus = KnownWindowsExitStatuses.get(UnsignedCode);
    const Parts = [
        `code=${Code}`,
        `hex=${FormatHex32(UnsignedCode)}`
    ];

    if(SignedCode !== Code){
        Parts.push(`signed=${SignedCode}`);
    }

    if(KnownStatus != undefined){
        Parts.push(`status=${KnownStatus}`);
    }

    return Parts.join(" ");
}

function DescribeProcessExit(Exit: ProcessExitInfo){
    return `${DescribeWindowsExitCode(Exit.code)} signal=${Exit.signal ?? "null"}`;
}

const KnownWindowsExitStatuses = new Map<number, string>([
    [0xC0000005, "STATUS_ACCESS_VIOLATION"],
    [0xC000001D, "STATUS_ILLEGAL_INSTRUCTION"],
    [0xC00000FD, "STATUS_STACK_OVERFLOW"],
    [0xC0000135, "STATUS_DLL_NOT_FOUND"],
    [0xC0000139, "STATUS_ENTRYPOINT_NOT_FOUND"],
    [0xC0000142, "STATUS_DLL_INIT_FAILED"],
    [0xC0000409, "STATUS_STACK_BUFFER_OVERRUN"],
    [0xC0000374, "STATUS_HEAP_CORRUPTION"],
    [0xE0434352, "CLR_EXCEPTION"]
]);

async function IsUdpPortInUse(Port: number){
    return await new Promise<boolean>((resolve) => {
        const Socket = dgram.createSocket("udp4");
        let Settled = false;

        const Finish = (Result: boolean) => {
            if(Settled){
                return;
            }

            Settled = true;
            Socket.removeAllListeners();
            try{
                Socket.close();
            }
            catch{
            }
            resolve(Result);
        };

        Socket.once("error", (Error: NodeJS.ErrnoException) => {
            Finish(Error.code === "EADDRINUSE");
        });

        Socket.once("listening", () => Finish(false));
        Socket.bind(Port, "0.0.0.0");
    });
}

async function WaitForUdpPortRelease(Port: number){
    const Deadline = Date.now() + GAMESERVER_PORT_RELEASE_TIMEOUT_MS;

    while(await IsUdpPortInUse(Port)){
        if(Date.now() >= Deadline){
            throw new Error(`Timed out waiting for gameserver UDP port ${Port} to be released`);
        }

        await setTimeout(50);
    }
}

function IsProcessAlive(ProcessId: number){
    try{
        kill(ProcessId, 0);
        return true;
    }
    catch{
        return false;
    }
}

function IsGameserverProcessAlive(GameserverToCheck: Gameserver){
    return IsProcessAlive(GameserverToCheck.processId);
}

function GetUdpPortOwnerPid(Port: number){
    try{
        const NetstatOutput = execFileSync("netstat", ["-ano"], {encoding: "utf8"});
        const PortPattern = new RegExp(`^\\s*UDP\\s+\\S+:${Port}\\s+\\S+\\s+(\\d+)\\s*$`, "mi");
        const Match = NetstatOutput.match(PortPattern);

        if(Match == undefined){
            return undefined;
        }

        return Number(Match[1]);
    }
    catch(Error){
        logger.warn(Error, `Failed to query owner for UDP port ${Port}`);
        return undefined;
    }
}

function CreateAdoptedFixedPortServer(Options: StartServerOptions, Port: number, ProcessId: number): Gameserver{
    const AdoptedServer: Gameserver = {
        id: crypto.randomUUID(),
        port: Port,
        map: Options.map,
        behemoth: Options.behemoth,
        matchmakerHuntId: Options.matchmakerHuntId,
        expectedPlayers: Options.expectedPlayers,
        isRamsgate: Options.isRamsgate,
        isTrainingDojo: Options.isTrainingDojo,
        origin: Options.origin,
        trigger: `adopted_existing:${Options.trigger}`,
        processId: ProcessId,
        startTime: new Date(),
        lastTouchedTime: new Date(),
        callbackToken: undefined,
        lastLifecycleHeartbeatTime: undefined,
        reportedLiveConnections: undefined,
        reportedRawConnections: undefined,
        hadLiveConnection: false,
        lifecycleRetirement: CreateLifecycleRetirementState(),
        shutdownAfterSeconds: Options.shutdownAfterSeconds,
        expectedShutdownReason: undefined,
        optimization: undefined,
        dllSha256: undefined,
        profiling: undefined,
        pacing: undefined
    };

    Gameservers.push(AdoptedServer);
    for(const Player of AdoptedServer.expectedPlayers ?? [])
        AddPlayerAssignment(Player.playerUid, AdoptedServer);
    logger.warn(`Adopted existing gameserver process ${ProcessId} on ${MY_IP}:${Port} origin=${Options.origin} map=${Options.map}`);

    return AdoptedServer;
}

function RegisterPendingGameserverReady(Id: string, Port: number, Token: string, ExpectedDllSha256: string){
    return new Promise<GameserverReadyPayload>((resolve, reject) => {
        PendingGameserverReadyById.set(Id, {
            port: Port,
            token: Token,
            expectedDllSha256: ExpectedDllSha256,
            resolve: resolve,
            reject: reject
        });
    });
}

function ParseProfilingStatus(Value: unknown): GameserverProfilingStatus | undefined{
    if(typeof Value !== "object" || Value == undefined){
        return undefined;
    }

    const Candidate = Value as Record<string, unknown>;
    const BooleanFields = ["enabled", "started", "startupWriteSucceeded", "writerStarted"] as const;
    const NumericFields = [
        "startupBytes", "startupError", "writerError", "intervalBytes", "intervalWriteFailures", "lastIntervalError"
    ] as const;

    if(!BooleanFields.every((Field) => typeof Candidate[Field] === "boolean") ||
        !NumericFields.every((Field) => typeof Candidate[Field] === "number" &&
            Number.isFinite(Candidate[Field]) && Number(Candidate[Field]) >= 0) ||
        typeof Candidate.path !== "string" || typeof Candidate.dllSha256 !== "string" ||
        (Candidate.dllSha256.length !== 0 && !/^[a-fA-F0-9]{64}$/.test(Candidate.dllSha256))){
        return undefined;
    }

    return Candidate as GameserverProfilingStatus;
}

function ParseRequiredProfilingDllSha256(Value: unknown){
    if(typeof Value !== "object" || Value == undefined){
        return undefined;
    }

    const DllSha256 = (Value as Record<string, unknown>).dllSha256;
    if(typeof DllSha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(DllSha256)){
        return undefined;
    }

    return DllSha256.toLowerCase();
}

function ParsePacingStatus(Value: unknown): GameserverPacingStatus | undefined{
    if(typeof Value !== "object" || Value == undefined){
        return undefined;
    }

    const Candidate = Value as Record<string, unknown>;
    const States = new Set(["disabled", "observing", "active", "fallback", "unknown"]);
    const BooleanFields = [
        "executableBuildValid", "signaturesValid", "hookEnabled", "highResolutionApiAvailable",
        "timerCreated", "correctionEverActivated"
    ] as const;
    const NumericFields = [
        "observedFrames", "cvarMaxFps", "cachedMaxFps", "virtualMaxFps",
        "rollingMedianCadenceHz", "rollingMedianCoarseOvershootMs"
    ] as const;

    if(!States.has(String(Candidate.state)) || typeof Candidate.installFailure !== "string" ||
        typeof Candidate.fallbackReason !== "string" ||
        !BooleanFields.every((Field) => typeof Candidate[Field] === "boolean") ||
        !NumericFields.every((Field) => typeof Candidate[Field] === "number" &&
            Number.isFinite(Candidate[Field]) && Number(Candidate[Field]) >= 0)){
        return undefined;
    }

    return Candidate as GameserverPacingStatus;
}

function ParseOptimizationMetrics(Value: unknown): GameserverOptimizationMetrics | undefined{
    if(typeof Value !== "object" || Value == undefined){
        return undefined;
    }

    const Candidate = Value as Record<string, unknown>;
    const Modes = new Set(["off", "report", "safe", "aggressive"]);
    const SafetyGates = new Set(["not_required", "passed", "initial_load", "connections_present", "timeout", "signature_mismatch", "failed"]);
    const NumericFields = [
        "candidates", "collected", "retained", "textures", "materials", "sounds",
        "mapPackageCandidates", "activeMapPackages", "inactiveMapPackages", "durationMs",
        "workingSetBefore", "workingSetAfter", "privateBytesBefore", "privateBytesAfter",
        "configuredMaxFps", "observedMaxFps", "preReadyNetworkingPasses",
        "netServerMaxTickRate", "maxNetTickRate", "bootstrapMinimumMilliseconds",
        "bootstrapMaximumMilliseconds", "considerCacheMaxAgeMilliseconds"
    ] as const;

    if(!Modes.has(String(Candidate.mode)) || !SafetyGates.has(String(Candidate.safetyGate)) ||
        typeof Candidate.signatureValid !== "boolean" || typeof Candidate.profilingEnabled !== "boolean" ||
        typeof Candidate.capSignatureValid !== "boolean" || typeof Candidate.capResolved !== "boolean" ||
        typeof Candidate.capApplied !== "boolean" || typeof Candidate.capVerified !== "boolean" ||
        typeof Candidate.failed !== "boolean" ||
        !NumericFields.every((Field) => typeof Candidate[Field] === "number" && Number.isFinite(Candidate[Field]) && Number(Candidate[Field]) >= 0) ||
        (Candidate.error != undefined && typeof Candidate.error !== "string")){
        return undefined;
    }

    return Candidate as GameserverOptimizationMetrics;
}

export function HandleGameserverReadyCallback(Token: string | undefined, Body: unknown){
    if(typeof Body !== "object" || Body == undefined){
        return {
            status: 400,
            body: {ready: false, error: "invalid_body"}
        };
    }

    const Payload = Body as Partial<GameserverReadyPayload>;

    if(typeof Payload.id !== "string" || typeof Payload.port !== "number" || typeof Payload.pid !== "number" ||
        (Payload.ready != undefined && typeof Payload.ready !== "boolean") ||
        (Payload.error != undefined && typeof Payload.error !== "string")){
        return {
            status: 400,
            body: {ready: false, error: "invalid_payload"}
        };
    }

    const PendingReady = PendingGameserverReadyById.get(Payload.id);

    if(PendingReady == undefined){
        return {
            status: 404,
            body: {ready: false, error: "unknown_gameserver"}
        };
    }

    if(Token !== PendingReady.token){
        return {
            status: 403,
            body: {ready: false, error: "invalid_token"}
        };
    }

    if(Payload.port !== PendingReady.port){
        return {
            status: 409,
            body: {ready: false, error: "port_mismatch"}
        };
    }

    if(Payload.ready === false){
        const FailureReason = Payload.error?.trim() || "unspecified native startup failure";
        PendingReady.reject(new Error(`Gameserver on port ${Payload.port} refused readiness: ${FailureReason}`));

        return {
            status: 200,
            body: {ready: false, error: "startup_failed"}
        };
    }

    const Optimization = ParseOptimizationMetrics(Payload.optimization);
    const Profiling = ParseProfilingStatus(Payload.profiling);
    const Pacing = ParsePacingStatus(Payload.pacing);
    const ReportedDllSha256 = ParseRequiredProfilingDllSha256(Payload.profiling);

    // Adopted fixed-port processes never register a pending readiness callback,
    // so this strict check applies only to a process spawned (and hashed) by this
    // DeployServer. Keep the rest of the profiling payload optional: a future
    // producer may add fields without making a valid hash unusable.
    if(GAMESERVER_PROFILING && ReportedDllSha256 == undefined){
        PendingReady.reject(new Error(
            `Gameserver on port ${Payload.port} did not report a valid profiling DLL SHA-256`));
        return {
            status: 409,
            body: {ready: false, error: "profiling_dll_hash_missing_or_invalid"}
        };
    }

    if(GAMESERVER_PROFILING && ReportedDllSha256 !== PendingReady.expectedDllSha256){
        PendingReady.reject(new Error(
            `Gameserver on port ${Payload.port} reported DLL SHA-256 ${ReportedDllSha256}; expected ${PendingReady.expectedDllSha256}`));
        return {
            status: 409,
            body: {ready: false, error: "profiling_dll_hash_mismatch"}
        };
    }

    if(Payload.optimization != undefined && Optimization == undefined){
        logger.warn({serverId: Payload.id, port: Payload.port}, "Ignoring invalid optional gameserver optimization metrics");
    }

    if(Payload.profiling != undefined && Profiling == undefined){
        logger.warn({serverId: Payload.id, port: Payload.port}, "Ignoring invalid optional gameserver profiling status");
    }

    if(Payload.pacing != undefined && Pacing == undefined){
        logger.warn({serverId: Payload.id, port: Payload.port}, "Ignoring invalid optional gameserver pacing status");
    }

    PendingReady.resolve({
        id: Payload.id,
        port: Payload.port,
        pid: Payload.pid,
        ready: true,
        optimization: Optimization,
        profiling: Profiling,
        pacing: Pacing
    });

    return {
        status: 200,
        body: {ready: true}
    };
}

export function HandleGameserverHeartbeat(Token: string | undefined, Body: unknown){
    if(typeof Body !== "object" || Body == undefined){
        return {status: 400, body: {accepted: false, error: "invalid_body"}};
    }

    const Payload = Body as Partial<GameserverHeartbeatPayload>;
    if(typeof Payload.id !== "string" || typeof Payload.port !== "number"
        || typeof Payload.pid !== "number"
        || typeof Payload.liveConnections !== "number"
        || typeof Payload.rawConnections !== "number"
        || !Number.isSafeInteger(Payload.port) || !Number.isSafeInteger(Payload.pid)
        || !Number.isSafeInteger(Payload.liveConnections)
        || Payload.liveConnections < 0 || Payload.liveConnections > 128
        || !Number.isSafeInteger(Payload.rawConnections)
        || Payload.rawConnections < 0 || Payload.rawConnections > 128){
        return {status: 400, body: {accepted: false, error: "invalid_payload"}};
    }

    const Server = Gameservers.find((Candidate) => Candidate.id === Payload.id);
    if(Server == undefined){
        return {status: 404, body: {accepted: false, error: "unknown_gameserver"}};
    }
    if(Token == undefined || Token !== Server.callbackToken){
        return {status: 403, body: {accepted: false, error: "invalid_token"}};
    }
    if(Server.port !== Payload.port || Server.processId !== Payload.pid){
        return {status: 409, body: {accepted: false, error: "identity_mismatch"}};
    }

    const LifecycleFields = [Payload.protocolVersion, Payload.heartbeatSequence,
        Payload.observationSequence, Payload.worldEpoch];
    const HasAnyLifecycleField = LifecycleFields.some((Value) => Value != undefined);
    const HasValidLifecycleFields =
        Payload.protocolVersion === LIFECYCLE_PROTOCOL_VERSION
        && typeof Payload.heartbeatSequence === "number"
        && Number.isSafeInteger(Payload.heartbeatSequence)
        && Payload.heartbeatSequence > 0
        && typeof Payload.observationSequence === "number"
        && Number.isSafeInteger(Payload.observationSequence)
        && Payload.observationSequence > 0
        && typeof Payload.worldEpoch === "number"
        && Number.isSafeInteger(Payload.worldEpoch)
        && Payload.worldEpoch >= 0
        && Payload.worldEpoch <= 0xffff;
    if(HasAnyLifecycleField && !HasValidLifecycleFields){
        CancelLifecycleRetirement(Server, "invalid_lifecycle_fields");
        return {status: 400, body: {accepted: false, error: "invalid_lifecycle_fields"}};
    }

    const Now = new Date();
    const PreviouslyConnected =
        (Server.reportedLiveConnections ?? 0) > 0 ||
        (Server.reportedRawConnections ?? 0) > 0;
    Server.lastLifecycleHeartbeatTime = Now;
    Server.reportedLiveConnections = Payload.liveConnections;
    Server.reportedRawConnections = Payload.rawConnections;
    const IsConnected =
        Payload.liveConnections > 0 || Payload.rawConnections > 0;
    if(IsConnected !== PreviouslyConnected){
        logger.info({
            serverId: Server.id,
            port: Server.port,
            liveConnections: Payload.liveConnections,
            rawConnections: Payload.rawConnections,
            lastPositiveConnection: IsConnected
                ? Now.toISOString()
                : Server.lastTouchedTime.toISOString()
        }, IsConnected
            ? "Gameserver observed a positive connection"
            : "Gameserver observed connection close; zero-evidence window begins");
    }

    const State = Server.lifecycleRetirement;
    if(!HasValidLifecycleFields){
        State.protocolVersion = undefined;
        State.heartbeatSequence = undefined;
        State.observationSequence = undefined;
        State.worldEpoch = undefined;
        CancelLifecycleRetirement(Server, "legacy_heartbeat");
        if(Payload.liveConnections > 0 || Payload.rawConnections > 0){
            Server.hadLiveConnection = true;
            TouchGameserver(Server, Now);
        }
        return {status: 200, body: {accepted: true, retirementEligible: false}};
    }

    const HeartbeatSequence = Payload.heartbeatSequence!;
    const ObservationSequence = Payload.observationSequence!;
    const WorldEpoch = Payload.worldEpoch!;
    if(State.heartbeatSequence != undefined &&
        HeartbeatSequence <= State.heartbeatSequence){
        CancelLifecycleRetirement(Server, "heartbeat_sequence_regression");
        return {status: 409, body: {accepted: false, error: "stale_heartbeat"}};
    }

    const ObservationAdvanced = State.observationSequence == undefined
        || ObservationSequence > State.observationSequence;
    const WorldChanged = State.worldEpoch != undefined && State.worldEpoch !== WorldEpoch;
    State.protocolVersion = LIFECYCLE_PROTOCOL_VERSION;
    State.heartbeatSequence = HeartbeatSequence;
    if(!ObservationAdvanced){
        CancelLifecycleRetirement(Server, "game_thread_observation_not_advanced");
        if(Payload.liveConnections > 0 || Payload.rawConnections > 0){
            Server.hadLiveConnection = true;
            TouchGameserver(Server, Now);
        }
        return {status: 200, body: {accepted: true, retirementEligible: false}};
    }
    State.observationSequence = ObservationSequence;
    State.worldEpoch = WorldEpoch;

    if(WorldChanged){
        TouchGameserver(Server, Now);
        logger.info({serverId: Server.id, port: Server.port, worldEpoch: WorldEpoch},
            "Gameserver lifecycle world changed; reset idle-retirement evidence");
    }

    if(Payload.liveConnections > 0 || Payload.rawConnections > 0){
        Server.hadLiveConnection = true;
        TouchGameserver(Server, Now);
    }
    else {
        if(State.zeroHeartbeatStreak === 0){
            State.zeroSinceTime = Now;
            logger.debug({serverId: Server.id, port: Server.port,
                heartbeatSequence: HeartbeatSequence, observationSequence: ObservationSequence,
                worldEpoch: WorldEpoch}, "Gameserver entered zero-connection lifecycle state");
        }
        ++State.zeroHeartbeatStreak;
    }

    return {status: 200, body: {accepted: true, retirementEligible: true}};
}

async function WaitForProcessExit(ProcessId: number, Port: number, ShouldStop: () => boolean): Promise<never>{
    while(!ShouldStop()){
        if(!IsProcessAlive(ProcessId)){
            throw new Error(`Gameserver on port ${Port} stopped during startup: process ${ProcessId} exited`);
        }

        await setTimeout(250);
    }

    return await new Promise<never>(() => {});
}

async function WaitForGameserverReady(StartedProcess: StartedGameserverProcess, Id: string, Port: number, ReadyPromise: Promise<GameserverReadyPayload>){
    let StopPollingProcess = false;
    const StartupFailurePromise = StartedProcess.child != undefined
        ? new Promise<never>((_, reject) => {
            StartedProcess.child!.once("exit", (Code, Signal) => {
                reject(new Error(`Gameserver on port ${Port} stopped during startup: ${DescribeProcessExit({code: Code, signal: Signal})}`));
            });

            StartedProcess.child!.once("error", (SpawnError) => {
                reject(new Error(`Gameserver on port ${Port} stopped during startup: spawn error: ${SpawnError.message}`));
            });
        })
        : WaitForProcessExit(StartedProcess.processId, Port, () => StopPollingProcess);

    try{
        return await Promise.race([
            ReadyPromise,
            StartupFailurePromise,
            setTimeout(GAMESERVER_STARTUP_TIMEOUT_SECONDS * 1000).then(() => {
                throw new Error(`Gameserver on port ${Port} did not report ready within ${GAMESERVER_STARTUP_TIMEOUT_SECONDS}s`);
            })
        ]);
    }
    finally{
        StopPollingProcess = true;
        PendingGameserverReadyById.delete(Id);
    }
}

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

async function ComputeGameserverDllSha256(){
    return await new Promise<string>((resolve, reject) => {
        const Hash = crypto.createHash("sha256");
        const Stream = createReadStream(GAMESERVER_DLL_PATH);

        Stream.on("data", (Chunk) => Hash.update(Chunk));
        Stream.once("error", reject);
        Stream.once("end", () => resolve(Hash.digest("hex")));
    });
}

async function StartGameserverProcess(Args: string[]): Promise<StartedGameserverProcess>{
    const Child = spawn(GAMESERVER_BINARY_PATH, Args, {
        detached: false,
        stdio: "ignore",
        windowsHide: !GAMESERVER_CONSOLE_LOG
    });

    return {
        processId: Child.pid!,
        child: Child
    };
}

export async function CleanupServer(ServerToShutdown: Gameserver){
    const WasTracked = Gameservers.includes(ServerToShutdown);
    Gameservers = Gameservers.filter(Server => Server !== ServerToShutdown);
    for(const PlayerId of [...(ServerToPlayers.get(ServerToShutdown.id) ?? [])])
        RemovePlayerAssignment(PlayerId);
    ServerToPlayers.delete(ServerToShutdown.id);

    if(!WasTracked && RamsgateServer !== ServerToShutdown && TrainingDojoServer !== ServerToShutdown){
        logger.warn(`Skipping cleanup for already removed gameserver ${ServerToShutdown.processId} on port ${ServerToShutdown.port}`);
        return;
    }

    if(ServerToShutdown.isRamsgate){
        if(RamsgateServer === ServerToShutdown){
            RamsgateServer = undefined;
        }

        if(ServerToShutdown.expectedShutdownReason == undefined){
            logger.warn("Ramsgate stopped unexpectedly; it will lazy-start on the next CITY request");
        }
        else{
            logger.info("Ramsgate stopped cleanly and remains dormant until the next CITY request");
        }
    }
    else if(ServerToShutdown.isTrainingDojo){
        logger.warn("Training Dojo cleaned up; it will lazy-start on the next request");

        if(TrainingDojoServer === ServerToShutdown){
            TrainingDojoServer = undefined;
        }

        TrainingDojoStartup = undefined;
    }
    else{
        FreePorts.push(ServerToShutdown.port);
    }
}

async function CleanupFailedStartup(NewGameserver: Gameserver, Options: StartServerOptions){
    NewGameserver.expectedShutdownReason = "startup_failed";

    try{
        kill(NewGameserver.processId);
    }
    catch(Error){
        logger.warn(Error, `Failed to signal failed gameserver startup ${NewGameserver.processId} on port ${NewGameserver.port}`);
    }

    Gameservers = Gameservers.filter(Server => Server !== NewGameserver);

    if(Options.isRamsgate){
        if(RamsgateServer === NewGameserver){
            RamsgateServer = undefined;
        }

        return;
    }

    if(Options.isTrainingDojo){
        if(TrainingDojoServer === NewGameserver){
            TrainingDojoServer = undefined;
        }

        TrainingDojoStartup = undefined;
        return;
    }

    FreePorts.push(NewGameserver.port);
}

export async function ShutdownServer(ServerToShutdown: Gameserver, Reason: string){
    if(ServerToShutdown.expectedShutdownReason != undefined){
        logger.debug({
            serverId: ServerToShutdown.id,
            port: ServerToShutdown.port,
            existingReason: ServerToShutdown.expectedShutdownReason,
            ignoredReason: Reason
        }, "Gameserver shutdown already in progress");
        return;
    }

    logger.info(`Shutting down gameserver ${ServerToShutdown.processId} on port ${ServerToShutdown.port} (${ServerToShutdown.origin}) due to ${Reason}`);
    ServerToShutdown.expectedShutdownReason = Reason;

    try{
        kill(ServerToShutdown.processId);
    }
    catch(Error){
        logger.warn(Error, `Failed to signal gameserver ${ServerToShutdown.processId} on port ${ServerToShutdown.port}`);
    }

    await WaitForUdpPortRelease(ServerToShutdown.port);

    await CleanupServer(ServerToShutdown);
}

let ServerLaunchQueue: Promise<void> = Promise.resolve();

type StartServerOptions = {
    map: string,
    behemoth: string | undefined,
    matchmakerHuntId: string | undefined,
    expectedPlayers: ExpectedPlayer[] | undefined,
    isRamsgate: boolean,
    isTrainingDojo: boolean,
    origin: GameserverOrigin,
    trigger: string,
    shutdownAfterSeconds: number | undefined
};

async function StartServer(Options: StartServerOptions){
    const LaunchProc = ServerLaunchQueue;

    ServerLaunchQueue = ServerLaunchQueue.catch(() => {}).then(async () => await setTimeout(SECONDS_TO_WAIT_BETWEEN_GAMESERVER_STARTUP * 1000));

    await LaunchProc;
    
    let Port: number | undefined;

    if(Options.isRamsgate){
        Port = RAMSGATE_PORT;
    }
    else if(Options.isTrainingDojo){
        Port = TRAINING_DOJO_PORT;
    }
    else{
        while(Port == undefined && FreePorts.length > 0){
            const CandidatePort = FreePorts.pop()!;

            if(await IsUdpPortInUse(CandidatePort)){
                logger.warn(`Skipping port ${CandidatePort} because it is already in use before gameserver startup`);
                continue;
            }

            Port = CandidatePort;
        }
    }

    const Id = crypto.randomUUID();

    if(Port == undefined){
        throw new NoFreeHuntPortsError();
    }

    if((Options.isRamsgate || Options.isTrainingDojo) && await IsUdpPortInUse(Port)){
        const OwnerPid = GetUdpPortOwnerPid(Port);

        if(OwnerPid != undefined){
            if(ADOPT_GAMESERVER){
                return CreateAdoptedFixedPortServer(Options, Port, OwnerPid);
            }

            throw new Error(`Fixed gameserver port ${Port} is already owned by pid ${OwnerPid}; refusing to adopt it with ADOPT_GAMESERVER=false`);
        }

        throw new Error(`Fixed gameserver port ${Port} is already in use before startup and its owner could not be identified`);
    }

    let DllSha256: string;

    try{
        DllSha256 = await ComputeGameserverDllSha256();
    }
    catch(CaughtError){
        if(!Options.isRamsgate && !Options.isTrainingDojo){
            FreePorts.push(Port);
        }
        throw new Error(`Failed to hash gameserver DLL at ${GAMESERVER_DLL_PATH}: ${CaughtError instanceof Error ? CaughtError.message : String(CaughtError)}`);
    }

    const ReadyCallbackToken = crypto.randomBytes(32).toString("hex");
    const ReadyPromise = RegisterPendingGameserverReady(Id, Port, ReadyCallbackToken, DllSha256);

    const GameserverArgs = [
        METAGAME_API_KEY,
        Port.toString(),
        Options.map,
        Options.behemoth != undefined ? Options.behemoth : "NO_BEHEMOTH",
        Options.matchmakerHuntId != undefined ? Options.matchmakerHuntId : "NO_MM_HUNTID",
        Options.expectedPlayers != undefined ? TransformExpectedPlayerArgs(Options.expectedPlayers) : "NO_EXPECTED_PLAYERS",
        MY_IP + ":" + Port.toString(),
        Id,
        GAMESERVER_READY_CALLBACK_URL,
        ReadyCallbackToken,
        `-undauntedConsoleLog=${GAMESERVER_CONSOLE_LOG}`,
        `-undauntedAssetStrippingMode=${GAMESERVER_ASSET_STRIPPING_MODE}`,
        `-undauntedStripInactiveMapPackages=${GAMESERVER_STRIP_INACTIVE_MAP_PACKAGES}`,
        `-undauntedAssetStrippingLogDetails=${GAMESERVER_ASSET_STRIPPING_LOG_DETAILS}`,
        `-undauntedAssetGcWaitSeconds=${GAMESERVER_ASSET_GC_WAIT_SECONDS}`,
        `-undauntedProfiling=${GAMESERVER_PROFILING}`,
        `-undauntedProfileIntervalSeconds=${GAMESERVER_PROFILE_INTERVAL_SECONDS}`,
        `-undauntedConsiderCacheMaxAgeMs=${GAMESERVER_CONSIDER_CACHE_MAX_AGE_MS}`,
        `-undauntedLifecycleCallbackUrl=${GAMESERVER_LIFECYCLE_CALLBACK_URL}`,
        `-undauntedDllSha256=${DllSha256}`,
        ...STANDARD_GAMESERVER_ARGS
    ];

    logger.info({
        id: Id,
        port: Port,
        origin: Options.origin,
        trigger: Options.trigger,
        map: Options.map,
        dllPath: GAMESERVER_DLL_PATH,
        dllSha256: DllSha256,
        behemoth: Options.behemoth,
        matchmakerHuntId: Options.matchmakerHuntId,
        expectedPlayers: Options.expectedPlayers
    }, "Starting gameserver process");

    const StartedProcess = await StartGameserverProcess(GameserverArgs);

    StartedProcess.child?.on("error", (Error) => {
        logger.error(Error, `Gameserver process failed to start for port ${Port}`);
    });
    let StartupCompleted = false;
    const NewGameserver: Gameserver = {
        id: Id,
        port: Port,
        map: Options.map,
        behemoth: Options.behemoth,
        matchmakerHuntId: Options.matchmakerHuntId,
        expectedPlayers: Options.expectedPlayers,
        isRamsgate: Options.isRamsgate,
        isTrainingDojo: Options.isTrainingDojo,
        origin: Options.origin,
        trigger: Options.trigger,
        processId: StartedProcess.processId,
        startTime: new Date(),
        lastTouchedTime: new Date(),
        callbackToken: ReadyCallbackToken,
        lastLifecycleHeartbeatTime: undefined,
        reportedLiveConnections: undefined,
        reportedRawConnections: undefined,
        hadLiveConnection: false,
        lifecycleRetirement: CreateLifecycleRetirementState(),
        shutdownAfterSeconds: Options.shutdownAfterSeconds,
        expectedShutdownReason: undefined,
        optimization: undefined,
        dllSha256: DllSha256,
        profiling: undefined,
        pacing: undefined
    };

    StartedProcess.child?.on("exit", (Code, Signal) => {
        const ExitMessage = `Gameserver process ${StartedProcess.processId} on port ${Port} exited: ${DescribeProcessExit({code: Code, signal: Signal})}`;

        if(NewGameserver.expectedShutdownReason != undefined){
            logger.info(`${ExitMessage} after expected shutdown: ${NewGameserver.expectedShutdownReason}`);
            return;
        }

        logger.warn(ExitMessage);

        if(!StartupCompleted){
            return;
        }

        void CleanupServer(NewGameserver).catch((Error) => {
            logger.error(Error, `Failed to cleanup gameserver ${StartedProcess.processId} on port ${Port} after unexpected exit`);
        });
    });

    Gameservers.push(NewGameserver);
    for(const Player of NewGameserver.expectedPlayers ?? [])
        AddPlayerAssignment(Player.playerUid, NewGameserver);

    try{
        const ReadyPayload = await WaitForGameserverReady(StartedProcess, Id, Port, ReadyPromise);
        NewGameserver.processId = ReadyPayload.pid;
        NewGameserver.optimization = ReadyPayload.optimization;
        NewGameserver.profiling = ReadyPayload.profiling;
        NewGameserver.pacing = ReadyPayload.pacing;
    }
    catch(Error){
        await CleanupFailedStartup(NewGameserver, Options);
        throw Error;
    }

    StartupCompleted = true;

    if(NewGameserver.optimization != undefined){
        logger.info({
            serverId: NewGameserver.id,
            port: Port,
            optimization: NewGameserver.optimization
        }, "Gameserver optimization completed before readiness");

    }

    logger.info({
        serverId: NewGameserver.id,
        port: Port,
        expectedDllSha256: DllSha256,
        profiling: NewGameserver.profiling,
        pacing: NewGameserver.pacing
    }, "Gameserver profiling startup status");

    logger.info(`Gameserver ${NewGameserver.processId} is ready on ${MY_IP}:${Port} origin=${Options.origin} trigger=${Options.trigger} map=${Options.map}`);

    return NewGameserver;
}

function StartRamsgateServer(Trigger: string){
    return StartServer({
        map: RAMSGATE_MAP_PATH,
        behemoth: undefined,
        matchmakerHuntId: undefined,
        expectedPlayers: undefined,
        isRamsgate: true,
        isTrainingDojo: false,
        origin: "RAMSGATE_LAZY",
        trigger: Trigger,
        shutdownAfterSeconds: RAMSGATE_IDLE_SHUTDOWN_SECONDS > 0
            ? RAMSGATE_IDLE_SHUTDOWN_SECONDS : undefined
    });
}

export async function GetRamsgateConnectionDetails(ExpectedPlayers: string[] = []){
    if(RamsgateShutdown != undefined){
        await RamsgateShutdown;
    }
    if(RamsgateServer != undefined && !IsGameserverProcessAlive(RamsgateServer)){
        await CleanupServer(RamsgateServer);
    }
    if(RamsgateServer?.expectedShutdownReason != undefined){
        throw new Error("Ramsgate shutdown is still in progress");
    }

    if(RamsgateServer == undefined){
        if(RamsgateStartup == undefined){
            RamsgateStartup = StartRamsgateServer("city_matchmaking").then((Server) => {
                RamsgateServer = Server;
                return Server;
            }).finally(() => {
                RamsgateStartup = undefined;
            });
        }
        RamsgateServer = await RamsgateStartup;
    }

    TouchGameserver(RamsgateServer);
    AssignPlayersToServer(RamsgateServer,
        TransformExpectedPlayers("ShatteredIsles_ReturnToRamsgate", ExpectedPlayers) ?? []);
    return {
        id: RamsgateServer.id,
        host: MY_IP,
        port: RamsgateServer.port
    };
}

export function GetGameserverIdleShutdownReason(Server: Gameserver, Now = Date.now()): GameserverIdleDecision | undefined{
    if(Server.shutdownAfterSeconds == undefined || Server.shutdownAfterSeconds <= 0
        || Server.expectedShutdownReason != undefined || Server.callbackToken == undefined
        || Server.lastLifecycleHeartbeatTime == undefined
        || Server.reportedLiveConnections !== 0 || Server.reportedRawConnections !== 0){
        return undefined;
    }

    const State = Server.lifecycleRetirement;
    if(State.protocolVersion !== LIFECYCLE_PROTOCOL_VERSION
        || State.heartbeatSequence == undefined
        || State.observationSequence == undefined
        || State.worldEpoch == undefined
        || State.zeroHeartbeatStreak < LIFECYCLE_MINIMUM_ZERO_HEARTBEATS
        || State.zeroSinceTime == undefined){
        return undefined;
    }

    const HeartbeatAgeSeconds =
        (Now - Server.lastLifecycleHeartbeatTime.getTime()) / 1000;
    if(HeartbeatAgeSeconds > LIFECYCLE_HEARTBEAT_STALE_SECONDS){
        CancelLifecycleRetirement(Server, "heartbeat_stale");
        return undefined;
    }

    const IdleSeconds = (Now - Server.lastTouchedTime.getTime()) / 1000;
    const RequiredIdleSeconds = Server.hadLiveConnection
        ? Server.shutdownAfterSeconds
        : Math.max(NEVER_CONNECTED_IDLE_GRACE_SECONDS, Server.shutdownAfterSeconds);
    if(IdleSeconds < RequiredIdleSeconds){
        return undefined;
    }

    if(State.armedHeartbeatSequence == undefined){
        State.armedHeartbeatSequence = State.heartbeatSequence;
        logger.info({
            serverId: Server.id,
            port: Server.port,
            heartbeatSequence: State.heartbeatSequence,
            observationSequence: State.observationSequence,
            worldEpoch: State.worldEpoch,
            zeroHeartbeatStreak: State.zeroHeartbeatStreak,
            idleSeconds: Math.floor(IdleSeconds)
        }, "Armed gameserver idle retirement; waiting for a confirming heartbeat");
        return undefined;
    }

    if(State.heartbeatSequence <= State.armedHeartbeatSequence){
        return undefined;
    }

    const Code: ShutdownReasonCode = Server.hadLiveConnection ? "idle" : "neverConnected";
    return {
        code: Code,
        serverId: Server.id,
        idleSeconds: Math.floor(IdleSeconds),
        zeroHeartbeatStreak: State.zeroHeartbeatStreak,
        reason: `${Code} for ${Math.floor(IdleSeconds)}s with ${State.zeroHeartbeatStreak} fresh zero-connection heartbeats`
    };
}

export function GetRamsgateIdleShutdownReason(Server: Gameserver, Now = Date.now()){
    return Server.isRamsgate ? GetGameserverIdleShutdownReason(Server, Now) : undefined;
}

export async function ShutdownIdleGameserver(Server: Gameserver, ExpectedDecision: GameserverIdleDecision){
    if(!Gameservers.includes(Server) || Server.expectedShutdownReason != undefined
        || !IsProcessAlive(Server.processId)){
        return;
    }

    const RevalidatedReason = GetGameserverIdleShutdownReason(Server);
    if(RevalidatedReason == undefined){
        logger.info({serverId: Server.id, port: Server.port, expectedReason: ExpectedDecision.reason},
            "Cancelled gameserver idle retirement during final revalidation");
        return;
    }

    await ShutdownServer(Server, RevalidatedReason.reason);
}

export async function ShutdownIdleRamsgate(Server: Gameserver, Decision: GameserverIdleDecision){
    if(RamsgateServer !== Server || Server.expectedShutdownReason != undefined){
        return;
    }
    const Operation = RamsgateShutdown ??= ShutdownIdleGameserver(Server, Decision);
    try{
        await Operation;
    }
    finally{
        if(RamsgateShutdown === Operation){
            RamsgateShutdown = undefined;
        }
    }
}

export function GetTrainingDojoConnectionDetails(){
    if(TrainingDojoServer == undefined){
        throw new Error("Training Dojo server has not started");
    }

    TouchGameserver(TrainingDojoServer);

    return {
        id: TrainingDojoServer.id,
        host: MY_IP,
        port: TrainingDojoServer.port
    };
}

function FindGameserverForPlayer(PlayerId: string){
    const Assigned = PlayerServerAssignments.get(PlayerId);
    if(Assigned == undefined)
        return undefined;
    if(Gameservers.includes(Assigned) && Assigned.expectedShutdownReason == undefined)
        return Assigned;
    RemovePlayerAssignment(PlayerId);
    return undefined;
}

export function CleanupPlayerAssignment(PlayerId: string){
    RemovePlayerAssignment(PlayerId);
}

export function CleanupStaleAssignments(Budget = 64){
    let Checked = 0;
    for(const [PlayerId, Server] of PlayerServerAssignments){
        if(Checked++ >= Budget)
            break;
        if(!Gameservers.includes(Server) || Server.expectedShutdownReason != undefined)
            RemovePlayerAssignment(PlayerId);
    }
}

// mm timing logging, no gameplay effect
export function GetRamsgatePrewarmStatus(){
    return {
        ready: RamsgateServer != undefined,
        restarting: RamsgateStartup != undefined,
        port: RamsgateServer?.port
    };
}

function FindHuntGameserversForPlayers(PlayerIds: string[]){
    const Players = new Set(PlayerIds);
    return Gameservers.filter((Candidate) =>
        !Candidate.isRamsgate
        && !Candidate.isTrainingDojo
        && Candidate.expectedShutdownReason == undefined
        && Candidate.expectedPlayers?.some((Player) => Players.has(Player.playerUid)));
}

function DetachPlayersFromGameservers(Servers: Gameserver[], PlayerIds: string[]){
    const Players = new Set(PlayerIds);

    for(const Server of Servers){
        Server.expectedPlayers = Server.expectedPlayers?.filter((Player) => !Players.has(Player.playerUid));
    }
}

function RetireReplacedGameservers(Servers: Gameserver[], PlayerIds: string[], Replacement: Gameserver){
    if(Servers.length === 0){
        return;
    }

    DetachPlayersFromGameservers(Servers, PlayerIds);
    logger.info({
        replacementServerId: Replacement.id,
        replacementPort: Replacement.port,
        playerIds: PlayerIds,
        retiredServers: Servers.map((Server) => ({id: Server.id, port: Server.port, processId: Server.processId}))
    }, "Retiring gameservers replaced by a fresh instance");

    for(const Server of Servers){
        void ShutdownServer(Server, `replaced_by_fresh_instance:${Replacement.id}`).catch((Error) => {
            logger.error(Error, `Failed to retire replaced gameserver ${Server.id} on port ${Server.port}`);
        });
    }
}

export async function GetGameserverStatusForPlayer(PlayerId: string){
    const Server = FindGameserverForPlayer(PlayerId);

    if(Server == undefined){
        return {
            found: false,
            joinable: false
        };
    }

    const ProcessAlive = IsGameserverProcessAlive(Server);
    const PortBound = await IsUdpPortInUse(Server.port);
    const Joinable = ProcessAlive && PortBound && Server.expectedShutdownReason == undefined;

    return {
        found: true,
        joinable: Joinable,
        server: {
            host: MY_IP,
            port: Server.port,
            id: Server.id,
            origin: Server.origin,
            map: Server.map,
            matchmakerHuntId: Server.matchmakerHuntId,
            expectedPlayers: Server.expectedPlayers,
            processAlive: ProcessAlive,
            portBound: PortBound,
            lastTouchedTime: Server.lastTouchedTime.toISOString()
        }
    };
}

export function TouchGameserverForPlayer(PlayerId: string){
    const Server = FindGameserverForPlayer(PlayerId);

    if(Server == undefined){
        return undefined;
    }

    TouchGameserver(Server);

    return {
        host: MY_IP,
        port: Server.port,
        id: Server.id,
        origin: Server.origin,
        lastTouchedTime: Server.lastTouchedTime.toISOString()
    };
}

export async function GetOrStartTrainingDojoConnectionDetails(
    Origin: GameserverOrigin,
    ExpectedPlayers: string[] = []
){
    if(TrainingDojoServer != undefined){
        AssignPlayersToServer(TrainingDojoServer,
            TransformExpectedPlayers(undefined, ExpectedPlayers) ?? []);
        return GetTrainingDojoConnectionDetails();
    }

    if(TrainingDojoStartup == undefined){
        TrainingDojoStartup = StartServer({
            map: TRAINING_DOJO_MAP_PATH,
            behemoth: undefined,
            matchmakerHuntId: undefined,
            expectedPlayers: undefined,
            isRamsgate: false,
            isTrainingDojo: true,
            origin: Origin,
            trigger: "training_dojo_matchmaking",
            shutdownAfterSeconds: TRAINING_DOJO_IDLE_SHUTDOWN_SECONDS
        }).then((Server) => {
            TrainingDojoServer = Server;
            return Server;
        }).finally(() => {
            TrainingDojoStartup = undefined;
        });
    }

    const Server = await TrainingDojoStartup;
    TouchGameserver(Server);
    AssignPlayersToServer(Server,
        TransformExpectedPlayers(undefined, ExpectedPlayers) ?? []);

    return {
        id: Server.id,
        host: MY_IP,
        port: Server.port
    };
}

function TransformExpectedPlayers(HuntId: string | undefined, ExpectedPlayers: string[] | undefined){
    return ExpectedPlayers?.map((PlayerId) => ({
        playerUid: PlayerId,
        playerHuntId: HuntId ?? "UNKNOWN_HUNT"
    }));
}

export async function StartupGameserverWithArgs(GameArgs: string, ExpectedPlayers: string[] | undefined){
    const Map = GameArgs.split("?")[0];
    const Behemoth = GameArgs.split("?")[2].split("=")[1];
    const ShutdownAfterSeconds = GetHuntIdleShutdownSeconds(undefined, undefined, GameArgs);

    const GameServerToReturn = await StartServer({
        map: Map,
        behemoth: Behemoth,
        matchmakerHuntId: undefined,
        expectedPlayers: TransformExpectedPlayers(undefined, ExpectedPlayers),
        isRamsgate: false,
        isTrainingDojo: false,
        origin: "HUNT_ARGS",
        trigger: GameArgs,
        shutdownAfterSeconds: ShutdownAfterSeconds
    });
    AssignPlayersToServer(GameServerToReturn,
        TransformExpectedPlayers(undefined, ExpectedPlayers) ?? []);

    return {
        id: GameServerToReturn.id,
        host: MY_IP,
        port: GameServerToReturn.port
    };
}

function GetMatchmakerHuntIdFromPlayerHuntId(PlayerHuntId: string){
    const MatchmakerHuntIDs = PLAYER_HUNT_ROWS[PlayerHuntId].MatchmakerHuntIDs;

    let MatchmakerHuntObject;

    if(MatchmakerHuntIDs.length !== 0){
        MatchmakerHuntObject = MatchmakerHuntIDs[crypto.randomInt(0, MatchmakerHuntIDs.length)];
    }

    return MatchmakerHuntObject?.RowName;
}

function GetBehemothPathFromMatchmakerHuntId(MatchmakerHuntId: string): string{
    const MatchmakerHuntObject = MATCHMAKER_HUNT_ROWS[MatchmakerHuntId];

    return MatchmakerHuntObject.SpecificBehemoth.BehemothAsset.AssetPathName;
}

function GetMapPathFromMatchmakerHuntId(MatchmakerHuntId: string): string{
    const MatchmakerHuntObject = MATCHMAKER_HUNT_ROWS[MatchmakerHuntId];

    const MapList = MatchmakerHuntObject.MapList;

    return MapList[crypto.randomInt(0, MapList.length)].MapAssetName.split(".")[0];
}

function GetGameModeOverrideFromMatchmakerHuntId(MatchmakerHuntId: string): string{
    const MatchmakerHuntObject = MATCHMAKER_HUNT_ROWS[MatchmakerHuntId];

    return MatchmakerHuntObject.GameModeOverride.replaceAll("Archon/Content", "/Game");
}

type TrialData = {
    Behemoth: string;
    TrialsHuntId: string;
}

const TRIAL_HUNT_ID_REGEX = /^Arena_MatchmakerHunt_(Hard|Elite)_(\d{3})$/;
const TRIAL_PLAYER_HUNT_ID_REGEX = /^(Trials_PlayerHunt_(Hard|Elite)_(\d{3}))(?:_(?:Day|Night))?$/;
const TRIALS_HARD_ROWS = TrialsHardHuntTable[0].Rows as any;
const TRIALS_ELITE_ROWS = TrialsEliteHuntTable[0].Rows as any;
const PLAYER_HUNT_ROWS = PlayerHuntTable[0].Rows as any;
const MATCHMAKER_HUNT_ROWS = MatchmakerHuntTable[0].Rows as any;
const TRIAL_ROWS = {
    Hard: TRIALS_HARD_ROWS,
    Elite: TRIALS_ELITE_ROWS
} as const;
let TrialByHuntId: Map<string, TrialData> | undefined;
let DisplayHuntByBehemoth: Map<string, string> | undefined;

function MakeTrial(TrialsHuntId: string, Row: any): TrialData{
    return {
        Behemoth: Row.SpecificBehemoth.BehemothAsset.AssetPathName,
        TrialsHuntId: TrialsHuntId
    };
}

function GetTrialIndex(){
    if(TrialByHuntId != undefined){
        return TrialByHuntId;
    }

    TrialByHuntId = new Map<string, TrialData>();

    for(const [Difficulty, Rows] of Object.entries(TRIAL_ROWS)){
        for(const [TrialsHuntId, Row] of Object.entries(Rows)){
            const Match = TRIAL_HUNT_ID_REGEX.exec(TrialsHuntId);

            if(Match == undefined || Match[1] !== Difficulty){
                continue;
            }

            const Data = MakeTrial(TrialsHuntId, Row);
            TrialByHuntId.set(TrialsHuntId, Data);
            TrialByHuntId.set(`Trials_PlayerHunt_${Difficulty}_${Match[2]}`, Data);
        }
    }

    TrialByHuntId.set("CR19_PlayerHunt_Arena_Hard", TrialByHuntId.get("Arena_MatchmakerHunt_Hard_001")!);
    TrialByHuntId.set("CR19_PlayerHunt_Arena_Elite", TrialByHuntId.get("Arena_MatchmakerHunt_Elite_001")!);

    logger.info({
        huntIdCount: TrialByHuntId.size
    }, "Indexed trials hunt ids");

    return TrialByHuntId;
}

function ResolveTrial(PlayerHuntId: string): TrialData | undefined{
    const AliasMatch = TRIAL_PLAYER_HUNT_ID_REGEX.exec(PlayerHuntId);
    const BasePlayerHuntId = AliasMatch?.[1] ?? PlayerHuntId;
    const Trial = GetTrialIndex().get(BasePlayerHuntId);

    if(Trial != undefined)
        return Trial;

    return PlayerHuntId.includes("Arena") ? RandomlyGenTrialsData(PlayerHuntId.includes("Elite")) : undefined;
}

function GetMatchmakerBehemothAssetPath(MatchmakerHuntId: string): string | undefined{
    const MatchmakerHuntObject = MATCHMAKER_HUNT_ROWS[MatchmakerHuntId];
    const BehemothAssetPath = MatchmakerHuntObject?.SpecificBehemoth?.BehemothAsset?.AssetPathName;

    return typeof BehemothAssetPath === "string" ? BehemothAssetPath : undefined;
}

function GetPlayerHuntMatchmakerIds(PlayerHunt: any): string[]{
    const MatchmakerHuntIDs = PlayerHunt?.MatchmakerHuntIDs;

    if(!Array.isArray(MatchmakerHuntIDs)){
        return [];
    }

    return MatchmakerHuntIDs
        .map((MatchmakerHuntID: any) => MatchmakerHuntID?.RowName)
        .filter((MatchmakerHuntId: any): MatchmakerHuntId is string => typeof MatchmakerHuntId === "string");
}

function GetDisplayHuntIndex(){
    if(DisplayHuntByBehemoth != undefined){
        return DisplayHuntByBehemoth;
    }

    DisplayHuntByBehemoth = new Map<string, string>();

    for(const [PlayerHuntId, PlayerHunt] of Object.entries(PLAYER_HUNT_ROWS)){
        for(const MatchmakerHuntId of GetPlayerHuntMatchmakerIds(PlayerHunt)){
            const BehemothAssetPath = GetMatchmakerBehemothAssetPath(MatchmakerHuntId);

            if(BehemothAssetPath == undefined || BehemothAssetPath.trim().length === 0){
                continue;
            }

            const ExistingPlayerHuntId = DisplayHuntByBehemoth.get(BehemothAssetPath);
            const IsPreferredPursuit = PlayerHuntId.startsWith("CR19_PlayerHunt_Pursuit_");
            const HasPreferredPursuit = ExistingPlayerHuntId?.startsWith("CR19_PlayerHunt_Pursuit_") === true;

            if(ExistingPlayerHuntId == undefined || (IsPreferredPursuit && !HasPreferredPursuit)){
                DisplayHuntByBehemoth.set(BehemothAssetPath, PlayerHuntId);
            }
        }
    }

    logger.info({
        behemothCount: DisplayHuntByBehemoth.size
    }, "Indexed trial display player hunts");

    return DisplayHuntByBehemoth;
}

function GetDisplayHuntId(Trial: TrialData | undefined): string | undefined{
    if(Trial == undefined || Trial.Behemoth.trim().length === 0){
        return undefined;
    }

    return GetDisplayHuntIndex().get(Trial.Behemoth);
}

function GetExpectedHuntId(Trial: TrialData | undefined, FallbackPlayerHuntId: string){
    const DisplayPlayerHuntId = GetDisplayHuntId(Trial);

    if(Trial != undefined && DisplayPlayerHuntId == undefined){
        logger.warn(`No canonical display player hunt found for trial ${Trial.TrialsHuntId}; falling back to ${FallbackPlayerHuntId}`);
    }

    return DisplayPlayerHuntId ?? FallbackPlayerHuntId;
}

function RandomlyGenTrialsData(IsElite: boolean): TrialData{
    const RandomTrialNum = String(crypto.randomInt(1, 89)).padStart(3, "0");

    const Difficulty = IsElite ? "Elite" : "Hard";

    const TrialsHuntId = `Arena_MatchmakerHunt_${Difficulty}_${RandomTrialNum}`;

    const Row = IsElite ? TRIALS_ELITE_ROWS[TrialsHuntId] : TRIALS_HARD_ROWS[TrialsHuntId];

    return MakeTrial(TrialsHuntId, Row);
}

export async function StartupGameserverWithHuntIdAndPlayers(HuntId: string, ExpectedPlayers: string[], FreshInstance = false){
    const Trial = ResolveTrial(HuntId);
    const MatchmakerHuntId = Trial == undefined ? GetMatchmakerHuntIdFromPlayerHuntId(HuntId) : Trial.TrialsHuntId;
    let BehemothPath = Trial == undefined ? GetBehemothPathFromMatchmakerHuntId(MatchmakerHuntId!) : Trial.Behemoth;
    let MapPath = Trial == undefined ? GetMapPathFromMatchmakerHuntId(MatchmakerHuntId!) : TRIALS_MAP_PATH;
    const ExpectedPlayerHuntId = GetExpectedHuntId(Trial, HuntId);

    if(MatchmakerHuntId != undefined && !MatchmakerHuntId.includes("Arena")){
        const OverrideGameMode = GetGameModeOverrideFromMatchmakerHuntId(MatchmakerHuntId);

        if(OverrideGameMode != undefined && OverrideGameMode.includes("_C")){
            logger.info(`Overriding gamemode to ${OverrideGameMode}`);
            MapPath = `${MapPath}?game=${OverrideGameMode}`;
        }
    }

    logger.info({
        huntId: HuntId,
        matchmakerHuntId: MatchmakerHuntId,
        expectedPlayerHuntId: ExpectedPlayerHuntId,
        behemoth: BehemothPath,
        map: MapPath,
        expectedPlayers: ExpectedPlayers,
        freshInstance: FreshInstance
    }, "Resolved hunt gameserver launch");

    const StartOptions: StartServerOptions = {
        map: MapPath,
        behemoth: BehemothPath,
        matchmakerHuntId: MatchmakerHuntId,
        expectedPlayers: TransformExpectedPlayers(ExpectedPlayerHuntId, ExpectedPlayers),
        isRamsgate: false,
        isTrainingDojo: false,
        origin: "HUNT_MATCHMAKER",
        trigger: HuntId,
        shutdownAfterSeconds: GetHuntIdleShutdownSeconds(HuntId, MatchmakerHuntId, MapPath)
    };

    const PreviousServers = FreshInstance ? FindHuntGameserversForPlayers(ExpectedPlayers) : [];
    let RetiredBeforeStartup = false;

    const RetireBeforeStartup = async () => {
        if(RetiredBeforeStartup || PreviousServers.length === 0){
            return;
        }

        RetiredBeforeStartup = true;
        logger.info({
            huntId: HuntId,
            playerIds: ExpectedPlayers,
            servers: PreviousServers.map((Server) => ({id: Server.id, port: Server.port, processId: Server.processId}))
        }, "No free hunt port; retiring previous gameservers before fresh startup");
        await Promise.all(PreviousServers.map((Server) => ShutdownServer(Server, "fresh_instance_port_required")));
    };

    if(FreshInstance && PreviousServers.length > 0 && FreePorts.length === 0){
        await RetireBeforeStartup();
    }

    let GameServerToReturn: Gameserver;
    try{
        GameServerToReturn = await StartServer(StartOptions);
    }
    catch(Error){
        if(FreshInstance && PreviousServers.length > 0 && !RetiredBeforeStartup && Error instanceof NoFreeHuntPortsError){
            await RetireBeforeStartup();
            GameServerToReturn = await StartServer(StartOptions);
        }
        else{
            throw Error;
        }
    }

    if(FreshInstance && !RetiredBeforeStartup){
        RetireReplacedGameservers(PreviousServers, ExpectedPlayers, GameServerToReturn);
    }

    if(FreshInstance){
        logger.info({
            huntId: HuntId,
            playerIds: ExpectedPlayers,
            serverId: GameServerToReturn.id,
            port: GameServerToReturn.port,
            replacementMode: RetiredBeforeStartup ? "old_first_no_free_port" : "new_first"
        }, "Fresh gameserver instance ready");
    }

    AssignPlayersToServer(GameServerToReturn,
        TransformExpectedPlayers(ExpectedPlayerHuntId, ExpectedPlayers) ?? []);

    return {
        id: GameServerToReturn.id,
        host: MY_IP,
        port: GameServerToReturn.port
    }
}

export async function Startup(){
    for(let i = PORT_RANGE_BEGIN; i <= PORT_RANGE_END - 2; i++){
        FreePorts.push(i);
    }

    logger.info("Ramsgate will start on the first CITY request");

    if(PREWARM_TRAINING_DOJO){
        await GetOrStartTrainingDojoConnectionDetails("TRAINING_DOJO_PREWARM");
    }
}
