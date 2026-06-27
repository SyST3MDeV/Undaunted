#include "networking.h"

#include <iostream>

using namespace SDK;

namespace Networking {
    UNetDriver* NetDriver = nullptr;
    static uintptr_t BaseAddress = 0x0;

    static std::vector<AActor*> BuildConsiderList(UWorld* World, UNetDriver* Driver) {
        std::vector<AActor*> Actors = std::vector<AActor*>();

        /*
        for (ULevel* Level : World->Levels) {
            for (AActor* Actor : Level->Actors) {
                if (!Actor)
                    continue;

                if (Actor->RemoteRole == ENetRole::ROLE_None)
                    continue;

                //if (!Actor->bReplicates)
                    //continue;

                reinterpret_cast<void(*)(AActor*, UNetDriver*)>(BaseAddress + 0x306B150)(Actor, Driver);

                Actors.push_back(Actor);
            }
        }
        */

        for (int i = 0; i < SDK::UObject::GObjects->Num(); i++)
        {
            SDK::UObject* Obj = SDK::UObject::GObjects->GetByIndex(i);

            if (!Obj)
                continue;

            if (Obj->IsDefaultObject())
                continue;

            if (Obj->IsA(SDK::AActor::StaticClass()))
            {
                AActor* Actor = (AActor*)Obj;

                if (Actor->RemoteRole == ENetRole::ROLE_None)
                    continue;

                if (Actor->bActorIsBeingDestroyed)
                    continue;

                if (!reinterpret_cast<UWorld * (*)(AActor*)>(*(void**)((uintptr_t)Actor->VTable + 0x150))(Actor)) {
                    continue;
                }
                
                reinterpret_cast<void(*)(AActor*, UNetDriver*)>(BaseAddress + 0x306B150)(Actor, Driver);

                Actors.push_back(Actor);
            }
        }

        return Actors;
    }

    static UActorChannel* GetActorChannelForConnectionAndActor(UNetConnection* Connection, AActor* Actor) {
        for (UChannel* Channel : Connection->OpenChannels) {
            if (Channel->Class == UActorChannel::StaticClass() && ((UActorChannel*)Channel)->Actor == Actor) {
                return ((UActorChannel*)Channel);
            }
        }

        return nullptr;
    }

    void Listen(UEngine* Engine, int Port) {
        BaseAddress = (uintptr_t)GetModuleHandleA(nullptr);

        FName GameNetDriver = UKismetStringLibrary::Conv_StringToName(L"GameNetDriver");

        std::cout << "Net driver create: " << (int)reinterpret_cast<uint8_t(*)(UEngine*, void*, FName, FName)>(BaseAddress + 0x371A5E0)(Engine, UWorld::GetWorld(), GameNetDriver, GameNetDriver) << std::endl;

        for (int i = 0; i < SDK::UObject::GObjects->Num(); i++)
        {
            SDK::UObject* Obj = SDK::UObject::GObjects->GetByIndex(i);

            if (!Obj)
                continue;

            if (Obj->IsDefaultObject())
                continue;

            if (Obj->IsA(SDK::UNetDriver::StaticClass()))
            {
                NetDriver = (UNetDriver*)Obj;
                break;
            }
        }

        std::cout << NetDriver->GetFullName() << std::endl;

        reinterpret_cast<void(*)(UNetDriver*, UWorld*)>(BaseAddress + 0x3491890)(NetDriver, UWorld::GetWorld());

        FURL url = FURL();

        url.Port = Port;

        FString empy = FString();

        std::cout << "Listen Status: " << (*(reinterpret_cast<bool(**)(UNetDriver*, void*, FURL*, bool, FString*)>(*(__int64*)NetDriver + 0x280)))(NetDriver, (void*)UWorld::GetWorld()->NetworkNotify, &url, false, &empy) << std::endl;

        reinterpret_cast<void(*)(UNetDriver*, UWorld*)>(BaseAddress + 0x3491890)(NetDriver, UWorld::GetWorld());

        UWorld::GetWorld()->NetDriver = NetDriver;
    }

    void TickNetworking() {
        UWorld::GetWorld()->NetDriver = NetDriver;

        NetDriver->World = UWorld::GetWorld();

        static FName name = FName();
        static bool nameInit = false;

        if (!nameInit) {
            nameInit = true;
            name = UKismetStringLibrary::Conv_StringToName(L"Actor");
        }

        ++ * (uint32_t*)((uintptr_t)NetDriver + 0x2AC);

        std::vector<AActor*> Actors = BuildConsiderList(UWorld::GetWorld(), NetDriver);

        for (UNetConnection* Connection : NetDriver->ClientConnections) {
            if (!Connection->OwningActor || *(uint32_t*)((uintptr_t)Connection + 0x134) != 3)
                continue;

            for (AActor* Actor : Actors) {
                if (Actor->IsA(APlayerController::StaticClass())) {
                    if (Actor != Connection->OwningActor) {
                        continue;
                    }
                    else {
                        //*(uint8_t*)((uintptr_t)Actor + 0xA14) = 0x1;
                        Connection->ViewTarget = ((APlayerController*)Actor)->GetViewTarget();

                        if (!Connection->ViewTarget)
                            std::cout << "NULL VIEWTARGET BAD THINGS WILL HAPPEN" << std::endl;

                        reinterpret_cast<void(*)(APlayerController*)>(BaseAddress + 0x359F9D0)((APlayerController*)Actor);
                    }
                }

                //

                UActorChannel* ActorChannel = GetActorChannelForConnectionAndActor(Connection, Actor);

                if (!ActorChannel) {
                    ActorChannel = reinterpret_cast<UActorChannel * (*)(UNetConnection*, FName*, unsigned int, int)>(BaseAddress + 0x3449E10)(Connection, &name, 1 << 1, -1);

                    if (ActorChannel) {
                        reinterpret_cast<void(*)(UActorChannel*, AActor*, unsigned int)>(BaseAddress + 0x3283450)(ActorChannel, Actor, 0);
                    }
                }

                if (ActorChannel && ActorChannel->Actor) {
                    if (!(*(int*)((uintptr_t)ActorChannel + 0x90) & 2u)) {
                        *(int*)((uintptr_t)ActorChannel + 0x90) |= 2u;
                    }
                    if (reinterpret_cast<bool(*)(UActorChannel*)>(BaseAddress + 0x327E860)(ActorChannel)) {
                        //std::cout << ActorChannel->Actor->GetFullName() << std::endl;
                    }
                }
            }
        }
    }
}