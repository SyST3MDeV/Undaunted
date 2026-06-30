#include <windows.h>
#include <shellapi.h>
#include <string>
#include <vector>
#include <thread>
#include <iostream>
#include <ranges>

#include "framework.h"
#include "SDK.hpp"
#include "MinHook/MinHook.h"
#include "constants.h"
#include "Networking.h"

#include "SDK/GameplayAbilities_parameters.hpp"
#include "SDK/Archon_parameters.hpp"
#include "SDK/lantern_equipped_ab_parameters.hpp"

#include <cwchar>

using namespace SDK;

namespace Globals {
    static bool AmServer = false;
    static uintptr_t BaseAddress = 0x0;
    bool Listening = false;
    bool DoListen = false;
    const wchar_t* ServerAPIKey = nullptr;
    const wchar_t* MapPath = nullptr;
    const wchar_t* BehemothPath = nullptr;
    const wchar_t* MatchmakerHuntId = nullptr;
    const wchar_t* ExpectedPlayerString = nullptr;
    int Port = 0;
    const wchar_t* MyIpAndPort = nullptr;

    bool EnableLogging = true;
}

__declspec(dllexport) const char* DummyLinkFunc() {
    return "mrow :3";
}

void MainThread() {
    while (!UWorld::GetWorld()) {
        if (Globals::AmServer) {
            Sleep(1000);
        }
        else {
            Sleep(1);
        }
    }

    Sleep(3 * 1000);

    if (!Globals::AmServer) {
        UEngine* Engine = UEngine::GetEngine();

        UInputSettings::GetDefaultObj()->ConsoleKeys[0].KeyName = UKismetStringLibrary::Conv_StringToName(L"F2");

        UObject* NewObject = UGameplayStatics::SpawnObject(Engine->ConsoleClass, Engine->GameViewport);

        Engine->GameViewport->ViewportConsole = static_cast<UConsole*>(NewObject);

        if (Globals::EnableLogging)
        std::cout << "Spawned UConsole!" << std::endl;
    }
    else {
        if (Globals::EnableLogging)
        std::cout << "UWorld is live!" << std::endl;

        Globals::DoListen = true;
    }
}

void* OrigGetDefaultMap = nullptr;

FString* GetGameDefaultMap(FString* a1) {
    FString* Ret = reinterpret_cast<FString*(*)(FString*)>(OrigGetDefaultMap)(a1);

    std::wstring FinalURL(Globals::MapPath);

    std::wstring BehemothPath(Globals::BehemothPath);

    if (!BehemothPath.contains(L"NO_BEHEMOTH")) {
        FinalURL += std::wstring(L"?MonsterClass=");
        FinalURL += std::wstring(BehemothPath);
    }

    std::wstring MatchmakerHuntId(Globals::MatchmakerHuntId);

    if (!MatchmakerHuntId.contains(L"NO_MM_HUNTID")) {
        FinalURL += std::wstring(L"?HuntId=");
        FinalURL += std::wstring(MatchmakerHuntId);
    }

    std::wstring ExpectedPlayers(Globals::ExpectedPlayerString);

    if (!ExpectedPlayers.contains(L"NO_EXPECTED_PLAYERS")) {
        FinalURL += std::wstring(L"?PlayerHuntIds=");
        FinalURL += std::wstring(ExpectedPlayers);
    }

    *Ret = FinalURL.c_str();

    //*Ret = L"/Game/Maps/islands/1705/dia_moss_triforce?MonsterClass=/Game/Monsters/mcrollin/mcbeaver_tutorial_bp.mcbeaver_tutorial_bp_C";
    //*Ret = L"/Game/Maps/islands/1705/dia_snow_big?MonsterClass=/Game/Monsters/mcrollin/mcbeaver_tutorial_bp.mcbeaver_tutorial_bp_C?HuntId=CR19_MatchmakerHunt_Beaver?PlayerHuntIds=GWOG-UID-1:CR19_PlayerHunt_Expedition_Island04,GWOG-UID-2:CR19_PlayerHunt_Expedition_Island04,GWOG-UID-3:CR19_PlayerHunt_Expedition_Island04?ZonePreset=0";
    //*Ret = L"/Game/Maps/ramsgate/ramsgate_01_persistent";
    //*Ret = L"/Game/Maps/islands/dojo/training_dojo_persistent";
    //*Ret = L"/Game/Maps/islands/1705/dia_moss_triforce?MonsterClass=/Game/Monsters/mcrollin/mcbeaver_tutorial_bp.mcbeaver_tutorial_bp_C";

    return Ret;
}

void* OrigGetCommandLine = nullptr;

const wchar_t* GetCommandLineHook() {
    return L"Dauntless-Win64-Shipping.exe -server -unattended -nullrhi -nosound -EpicPortal -RepDriverDisable";
}

void* OrigServerBootCrash = nullptr;

void ServerBootCrash() {
    return;
}

void* OrigEncounterableSetup = nullptr;

void EncounterableSetupHook() {
    return;
}

float RestartPlayerTimer = 0.0f;

float TotalNoPlayersTime = 0.0f;

bool EnableWatchdog = true;

void* OrigGameEngineTick = nullptr;

void GameEngineTickHook(UGameEngine* GameEngine, float DeltaTime, char CanRender) {
    reinterpret_cast<void(*)(UGameEngine*, float, char)>(OrigGameEngineTick)(GameEngine, DeltaTime, CanRender);

    if (RestartPlayerTimer > 0.0f) {
        RestartPlayerTimer -= DeltaTime;

        if (RestartPlayerTimer <= 0.0f) {
            for (UNetConnection* Conn : Networking::NetDriver->ClientConnections) {
                if (Conn->PlayerController && Conn->PlayerController->Pawn && Conn->PlayerController->Pawn->IsA(ABP_PlayerCharacter_C::StaticClass())) {
                    Conn->PlayerController->ClientTravel(Globals::MyIpAndPort, ETravelType::TRAVEL_Absolute, true, FGuid());
                }
            }
        }
    }

    if (Globals::Listening) {
        Networking::TickNetworking();
    }

    if (Globals::DoListen) {
        Globals::DoListen = false;
        Networking::Listen(UEngine::GetEngine(), Globals::Port);

        Globals::Listening = true;
    }

    if (Globals::Listening && Networking::NetDriver) {
        bool HasConnection = false;

        for (UNetConnection* Connection : Networking::NetDriver->ClientConnections) {
            if (!Connection->OwningActor || *(uint32_t*)((uintptr_t)Connection + 0x134) != 3)
                continue;

            HasConnection = true;
        }

        if (EnableWatchdog) {
            if (!HasConnection) {
                TotalNoPlayersTime += DeltaTime;

                if (TotalNoPlayersTime >= 50.0f) {
                    exit(0);
                }
            }
        }

        for (UNetConnection* Conn : Networking::NetDriver->ClientConnections) {
            if (Conn->PlayerController && Conn->PlayerController->Pawn && Conn->PlayerController->Pawn->IsA(ABP_PlayerCharacter_C::StaticClass())) {
                ((ABP_PlayerCharacter_C*)Conn->PlayerController->Pawn)->TickStamina(ECityExecFilter::Both, ERemoteExecFilter::All);
            }
        }
    }
}

void* OrigFixupNetworkNotify = nullptr;

void* FixupNetworkNotifyHook(void* a1) {
    if(UWorld::GetWorld())
        *(void**)((uintptr_t)a1 + 0x208) = &UWorld::GetWorld()->NetworkNotify;

    return reinterpret_cast<void* (*)(void*)>(OrigFixupNetworkNotify)(a1);
}

void* OrigProcessRequest = nullptr;

char ProcessRequest(void* Request) {
    FString APIHeader(L"x-undaunted-gameserver-apikey");
    FString APIKey(Globals::ServerAPIKey);

    reinterpret_cast<void(*)(void*, FString*, FString*)>(Globals::BaseAddress + 0x28AAAA0)(Request, &APIHeader, &APIKey);

    return reinterpret_cast<char(*)(void*)>(OrigProcessRequest)(Request);
}

enum EFunctionCallspace : uint32_t
{
    /** This function call should be absorbed (ie client side with no authority) */
    Absorbed = 0x0,
    /** This function call should be called remotely via its net driver */
    Remote = 0x1,
    /** This function call should be called locally */
    Local = 0x2
};

void* OrigGetActorCallspace = nullptr;

EFunctionCallspace GetActorCallspace(AActor* Actor, UFunction* Function, void* Stack) {
    return (EFunctionCallspace)3;

    if ((Function->FunctionFlags & (uint32_t)EFunctionFlags::NetMulticast) == (uint32_t)EFunctionFlags::NetMulticast) {
        return (EFunctionCallspace)3;
        //return EFunctionCallspace::Remote;
    }

    if ((Function->FunctionFlags & (uint32_t)EFunctionFlags::NetClient) == (uint32_t)EFunctionFlags::NetClient) {
        return (EFunctionCallspace)1;
        //return EFunctionCallspace::Remote;
    }

    return reinterpret_cast<EFunctionCallspace(*)(AActor*, UFunction*, void*)>(OrigGetActorCallspace)(Actor, Function, Stack);
}

void* OrigPostLogin = nullptr;

void PostLoginHook(void* a1, AArchonPlayerController* a2) {
    reinterpret_cast<void(*)(void*, void*)>(OrigPostLogin)(a1, a2);
}

void* OrigHasFinishedLoading = nullptr;

bool HasFinishedLoadingHook(UObject* a1) {
    bool Ret = reinterpret_cast<bool(*)(UObject*)>(OrigHasFinishedLoading)(a1);

    if (!Ret) {
        if (Globals::EnableLogging)
        std::cout << "[FORCEREADY] " << a1->GetFullName() << std::endl;
        return true;
    }

    return Ret;
}

void* OrigIsNetReady = nullptr;

bool IsNetReadyHook() {
    return true;
}

void* OrigSetReplicationDriver = nullptr;

void SetReplicationDriverHook(UNetDriver* NetDriver, UReplicationDriver* RepDriver) {
    return reinterpret_cast<void(*)(UNetDriver*, UReplicationDriver*)>(OrigSetReplicationDriver)(NetDriver, nullptr);
}

void* OrigGetNetDriverInternal = nullptr;

UNetDriver* GetNetDriverInternalHook(void* a1, void* a2) {
    UNetDriver* NetDriver = reinterpret_cast<UNetDriver* (*)(void*, void*)>(OrigGetNetDriverInternal)(a1, a2);

    if (!NetDriver) {
        NetDriver = Networking::NetDriver;
    }

    return NetDriver;
}

void* OrigIsLevelInitForActor = nullptr;

bool IsLevelInitForActorHook(void* a1, char a2) {
    bool NetDriver = reinterpret_cast<bool (*)(void*, char)>(OrigIsLevelInitForActor)(a1, a2);

    if (!NetDriver) {
        return true;
    }

    return NetDriver;
}

void* OrigGetStartSpot = nullptr;

APlayerStart* GetStartSpotHook(void* a1, void* a2, void* a3) {
    for (int i = 0; i < SDK::UObject::GObjects->Num(); i++)
    {
        SDK::UObject* Obj = SDK::UObject::GObjects->GetByIndex(i);

        if (!Obj)
            continue;

        if (Obj->IsDefaultObject())
            continue;

        if (Obj->IsA(SDK::APlayerStart::StaticClass()))
        {
            return (APlayerStart*)Obj;
        }
    }

    if (Globals::EnableLogging)
    std::cout << "No startspot found!" << std::endl;

    return nullptr;
}

bool ServerTryActivateAbilityInternal(UAbilitySystemComponent* Component, FGameplayAbilitySpecHandle& AbilityHandle, bool InputPressed, FPredictionKey& PredictionKey, FGameplayEventData* TriggerEventData) {
    if (Globals::EnableLogging)
    std::cout << "Activated ability!" << std::endl;

    if(InputPressed)
        Component->ServerSetInputPressed(AbilityHandle);

    void* InstancedAbility = nullptr;

    bool Activated = reinterpret_cast<bool(*)(UAbilitySystemComponent*, uint32_t, FPredictionKey*, void**, void*, FGameplayEventData*)>(Globals::BaseAddress + 0x10C8C80)(Component, AbilityHandle.Handle, &PredictionKey, &InstancedAbility, nullptr, TriggerEventData);

    if (!Activated && InputPressed)
        Component->ServerSetInputReleased(AbilityHandle);

    return Activated;
}

void* OrigMakeDoDamage = nullptr;

bool MakeDoDamageHook(void* a1, void* a2, void* a3) {
    return true;
}

#include <fstream>

void* OrigProcessEventClient = nullptr;

void ProcessEventClientHook(UObject* Object, UFunction* Function, void* Parms) {
    if (GetAsyncKeyState(VK_F9)) {
        std::ofstream file("quests.txt");

        for (int i = 0; i < SDK::UObject::GObjects->Num(); i++)
        {
            SDK::UObject* Obj = SDK::UObject::GObjects->GetByIndex(i);

            if (!Obj)
                continue;

            if (Obj->IsA(SDK::UQuest::StaticClass()))
            {
                UQuest* Quest = (UQuest*)Obj;
                file << Quest->GetId().ToString() << std::endl;
                file << Quest->GetTitle().ToString() << std::endl;
                file << "===========================" << std::endl;
            }
        }
        
        while (GetAsyncKeyState(VK_F9)) {

        }
    }

    reinterpret_cast<void(*)(UObject*, UFunction*, void*)>(OrigProcessEventClient)(Object, Function, Parms);
}

static int NumTimesOnAirshipUpdated = 0;
bool DidDoTravelReset = false;

void* OrigProcessEvent = nullptr;

void ProcessEventHook(UObject* Object, UFunction* Function, void* Parms) {
    static UFunction* ServerTryActivateAbilityWithEventData = nullptr;
    static UFunction* ServerTryActivateAbility = nullptr;
    static UFunction* OnAirshipUpdated = nullptr;
    static UFunction* OnPostMitDealtAnyDamage = nullptr;

    if (Function == ServerTryActivateAbilityWithEventData || (!ServerTryActivateAbilityWithEventData && Function->GetFullName().contains("ServerTryActivateAbilityWithEventData"))) {
        ServerTryActivateAbilityWithEventData = Function;

        Params::AbilitySystemComponent_ServerTryActivateAbilityWithEventData* ActivateAbilityParams = (Params::AbilitySystemComponent_ServerTryActivateAbilityWithEventData*)Parms;

        ServerTryActivateAbilityInternal((UAbilitySystemComponent*)Object, ActivateAbilityParams->AbilityToActivate, ActivateAbilityParams->InputPressed, ActivateAbilityParams->PredictionKey, &ActivateAbilityParams->TriggerEventData);
    }
    else if (Function == ServerTryActivateAbility || (!ServerTryActivateAbility && Function->GetFullName().contains("ServerTryActivateAbility"))) {
        ServerTryActivateAbility = Function;

        Params::AbilitySystemComponent_ServerTryActivateAbility* ActivateAbilityParams = (Params::AbilitySystemComponent_ServerTryActivateAbility*)Parms;

        ServerTryActivateAbilityInternal((UAbilitySystemComponent*)Object, ActivateAbilityParams->AbilityToActivate, ActivateAbilityParams->InputPressed, ActivateAbilityParams->PredictionKey, nullptr);
    }

    if (Function == OnAirshipUpdated || (!OnAirshipUpdated && Function->GetFullName().contains("OnAirshipUpdated"))) {
        OnAirshipUpdated = Function;

        NumTimesOnAirshipUpdated++;

        if (NumTimesOnAirshipUpdated >= 2 && !DidDoTravelReset) {
            DidDoTravelReset = true;

            RestartPlayerTimer = 10.0f;
        }
    }

    if (Function == OnPostMitDealtAnyDamage || (!OnPostMitDealtAnyDamage && Function->GetFullName().contains("OnPostMitDealtAnyDamage"))) {
        OnPostMitDealtAnyDamage = Function;

        //OnPostMitDamage
        Params::lantern_equipped_ab_C_OnPostMitDealtAnyDamage* LanternParms = (Params::lantern_equipped_ab_C_OnPostMitDealtAnyDamage*)Parms;

        UGameplayAbility* Obj = (UGameplayAbility*)Object;

        ABP_PlayerCharacter_C* PlayerCharacter = (ABP_PlayerCharacter_C*)Obj->GetAvatarActorFromActorInfo();

        if (PlayerCharacter) {
            AArchonWeapon* Weapon = PlayerCharacter->GetWeapon();

            if (Weapon && Weapon->IsA(ABP_EB_Weapon_C::StaticClass())) {
                UFunction* PostMitFunc = Weapon->Class->GetFunction("BP_EB_Weapon_C", "OnPostMitDamage");

                if (PostMitFunc) {
                    //std::cout << "Proc'ing Post-mit callback on compat weapon!" << std::endl;
                    reinterpret_cast<void(*)(UObject*, UFunction*, void*)>(OrigProcessEvent)(Weapon, PostMitFunc, Parms);
                }
            }
        }
    }

    reinterpret_cast<void(*)(UObject*, UFunction*, void*)>(OrigProcessEvent)(Object, Function, Parms);
}

void InitClientHooks() {
    MH_Initialize();

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1528000), HasFinishedLoadingHook, &OrigHasFinishedLoading);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1528000));

    //MH_CreateHook((void*)(Globals::BaseAddress + 0x347E110), IsNetReadyHook, &OrigIsNetReady);

    //MH_EnableHook((void*)(Globals::BaseAddress + 0x347E110));

    //MH_CreateHook((void*)(Globals::BaseAddress + 0x1F61820), ProcessEventClientHook, &OrigProcessEventClient);

    //MH_EnableHook((void*)(Globals::BaseAddress + 0x1F61820));
}

void* OrigSprint = nullptr;

bool SprintHook(uintptr_t a1, uintptr_t a2) { //char __fastcall UArchonStaminaComponent_TryConsumeStamina_Native(__int64 a1, __int64 a2, char a3, char a4)    
    return true;
}

void* OrigWeaponHook = nullptr;

AActor* WeaponHook(UActorComponent* a1) { //char __fastcall UArchonStaminaComponent_TryConsumeStamina_Native(__int64 a1, __int64 a2, char a3, char a4)            
    AActor* Ret = reinterpret_cast<AActor* (*)(UActorComponent * a1)>(OrigWeaponHook)(a1);

    return Ret;
}

void InitServerHooks() {
    MH_Initialize();

    MH_CreateHook((void*)(Globals::BaseAddress + 0x25A37C0), GetGameDefaultMap, &OrigGetDefaultMap);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x25A37C0));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1D06D40), GetCommandLineHook, &OrigGetCommandLine);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1D06D40));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x2E4D7F0), ServerBootCrash, &OrigServerBootCrash);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x2E4D7F0));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1658f90), EncounterableSetupHook, &OrigEncounterableSetup);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1658f90));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x3307100), GameEngineTickHook, &OrigGameEngineTick);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x3307100));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x820120), FixupNetworkNotifyHook, &OrigFixupNetworkNotify);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x820120));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x28A76C0), ProcessRequest, &OrigProcessRequest);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x28A76C0));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1390300), EncounterableSetupHook, &OrigEncounterableSetup); // TODO: Rename to combat text

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1390300));

    //MH_CreateHook((void*)(Globals::BaseAddress + 0x3077710), GetActorCallspace, &OrigGetActorCallspace);

    //MH_EnableHook((void*)(Globals::BaseAddress + 0x3077710));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x14B7460), PostLoginHook, &OrigPostLogin);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x14B7460));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1528000), HasFinishedLoadingHook, &OrigHasFinishedLoading);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1528000));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x347E110), IsNetReadyHook, &OrigIsNetReady);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x347E110));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x3491720), SetReplicationDriverHook, &OrigSetReplicationDriver);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x3491720));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x3078AF0), GetNetDriverInternalHook, &OrigGetNetDriverInternal);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x3078AF0));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x3458780), IsLevelInitForActorHook, &OrigIsLevelInitForActor);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x3458780));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1368660), GetStartSpotHook, &OrigGetStartSpot);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1368660));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1F61820), ProcessEventHook, &OrigProcessEvent);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1F61820));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x11107D0), MakeDoDamageHook, &OrigMakeDoDamage);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x11107D0));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x137A800), SprintHook, &OrigSprint);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x137A800));

    MH_CreateHook((void*)(Globals::BaseAddress + 0x1496590), WeaponHook, &OrigWeaponHook);

    MH_EnableHook((void*)(Globals::BaseAddress + 0x1496590));

    

    //

    //13CA280

    //GetStartSpotHook

    // Fixup Listen failure
    DWORD oldProtect;
    VirtualProtect((void*)(Globals::BaseAddress + 0x372E746), 0x5, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x372E746 + 0x0) = 0xB0;
    *(uint8_t*)(Globals::BaseAddress + 0x372E746 + 0x1) = 0x01;
    *(uint8_t*)(Globals::BaseAddress + 0x372E746 + 0x2) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x372E746 + 0x3) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x372E746 + 0x4) = 0x90;

    VirtualProtect((void*)(Globals::BaseAddress + 0x372E746), 0x5, oldProtect, &oldProtect);

    // Fixup Ramsgate Crash
    VirtualProtect((void*)(Globals::BaseAddress + 0x1346A98), 0x7, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x0) = 0x33;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x1) = 0xF6;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x2) = 0x33;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x3) = 0xC0;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x4) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x5) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x1346A98 + 0x6) = 0x90;

    VirtualProtect((void*)(Globals::BaseAddress + 0x1346A98), 0x7, oldProtect, &oldProtect);

    //GIsServer and GIsClient
    VirtualProtect((void*)(Globals::BaseAddress + 0x7961AE), 0x9, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x0) = 0xC6;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x1) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x2) = 0x84;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x3) = 0x5A;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x4) = 0x6B;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x5) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x6) = 0x00;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x7) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x7961AE + 0x8) = 0x90;

    VirtualProtect((void*)(Globals::BaseAddress + 0x7961AE), 0x9, oldProtect, &oldProtect);

    VirtualProtect((void*)(Globals::BaseAddress + 0x7961BB), 0x9, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x0) = 0xC6;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x1) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x2) = 0x78;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x3) = 0x5A;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x4) = 0x6B;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x5) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x6) = 0x01;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x7) = 0x90;
    *(uint8_t*)(Globals::BaseAddress + 0x7961BB + 0x8) = 0x90;

    VirtualProtect((void*)(Globals::BaseAddress + 0x7961BB), 0x9, oldProtect, &oldProtect);

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A81B), 0x7, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x0) = 0xC6;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x1) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x2) = 0x17;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x3) = 0x14;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x4) = 0x6B;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x5) = 0x05;
    *(uint8_t*)(Globals::BaseAddress + 0x79A81B + 0x6) = 0x00;

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A81B), 0x7, oldProtect, &oldProtect);

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A680), 0x1, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x79A680 + 0x0) = 0x00;

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A680), 0x1, oldProtect, &oldProtect);

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A815), 0x1, PAGE_READWRITE, &oldProtect);

    *(uint8_t*)(Globals::BaseAddress + 0x79A815 + 0x0) = 0x01;

    VirtualProtect((void*)(Globals::BaseAddress + 0x79A815), 0x1, oldProtect, &oldProtect);
}

void Init() {

    Globals::AmServer = std::string(GetCommandLineA()).contains("-server");
    Globals::BaseAddress = (uintptr_t)GetModuleHandleA(nullptr);

    if (Globals::AmServer) {
        *(uint8_t*)(Globals::BaseAddress + 0x5E4BC3A) = 0x1; // GIsServer
        *(uint8_t*)(Globals::BaseAddress + 0x5E4BC39) = 0x0; // GIsClient
    }

    UC::FMemory::Init((void*)(Globals::BaseAddress + 0x1C8EE00));

    if (Globals::AmServer) {
        int NumArgs = 0;

        wchar_t** Args = CommandLineToArgvW(GetCommandLineW(), &NumArgs);

        if (NumArgs > 8) {
            Globals::ServerAPIKey = Args[1];
            Globals::Port = std::stoi(std::wstring(Args[2]));
            Globals::MapPath = Args[3];
            Globals::BehemothPath = Args[4];
            Globals::MatchmakerHuntId = Args[5];
            Globals::ExpectedPlayerString = Args[6];
            Globals::MyIpAndPort = Args[7];

            if (Globals::Port >= 8776) {
                EnableWatchdog = false;
                Globals::EnableLogging = true;
            }
        }
        else {
            MessageBoxA(nullptr, "INVALID GAMESERVER ARGS", "INVALID GAMESERVER ARGS", 0);
            exit(0);
            return;
        }

        if (Globals::EnableLogging) {
            AllocConsole();
            FILE* Dummy;
            freopen_s(&Dummy, "CONOUT$", "w", stdout);
            freopen_s(&Dummy, "CONIN$", "r", stdin);

            std::cout << "Welcome to Undaunted v" << UNDAUNTED_INTERNAL_VERSION << "!" << std::endl;
            std::cout << "prod. gwog :3" << std::endl;
            std::cout << "thanks to all who contributed in any way, you know who you are, dm me on discord if you want a named shoutout here :3" << std::endl;

            std::cout << "Running as a server!" << std::endl;
        }

        InitServerHooks();
    }
    else {
        Globals::EnableLogging = true;

        if (Globals::EnableLogging) {
            AllocConsole();
            FILE* Dummy;
            freopen_s(&Dummy, "CONOUT$", "w", stdout);
            freopen_s(&Dummy, "CONIN$", "r", stdin);

            std::cout << "Welcome to Undaunted v" << UNDAUNTED_INTERNAL_VERSION << "!" << std::endl;
            std::cout << "prod. gwog :3" << std::endl;
            std::cout << "thanks to all who contributed in any way, you know who you are, dm me on discord if you want a named shoutout here :3" << std::endl;

            std::cout << "Running as a debug-enabled client!" << std::endl;
        }

        InitClientHooks();
    }

    DWORD threadId;
    CreateThread(nullptr, 0x1000, (LPTHREAD_START_ROUTINE)MainThread, nullptr, 0, &threadId);
}

BOOL APIENTRY DllMain( HMODULE hModule,
                       DWORD  ul_reason_for_call,
                       LPVOID lpReserved
                     )
{
    switch (ul_reason_for_call)
    {
    case DLL_PROCESS_ATTACH:
        DisableThreadLibraryCalls(hModule);
        Init();
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}

