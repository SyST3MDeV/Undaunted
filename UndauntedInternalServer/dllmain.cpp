#include <string>
#include <vector>
#include <thread>
#include <iostream>

#include "framework.h"
#include "SDK.hpp"
#include "MinHook/MinHook.h"
#include "constants.h"

using namespace SDK;

namespace Globals {
    static bool AmServer = false;
}

__declspec(dllexport) const char* DummyLinkFunc() {
    return "mrow :3";
}

void MainThread() {
    while (!UWorld::GetWorld()) {

    }

    Sleep(3 * 1000);

    if (!Globals::AmServer) {
        UEngine* Engine = UEngine::GetEngine();

        UInputSettings::GetDefaultObj()->ConsoleKeys[0].KeyName = UKismetStringLibrary::Conv_StringToName(L"F2");

        UObject* NewObject = UGameplayStatics::SpawnObject(Engine->ConsoleClass, Engine->GameViewport);

        Engine->GameViewport->ViewportConsole = static_cast<UConsole*>(NewObject);

        std::cout << "Spawned UConsole!" << std::endl;
    }
}

void Init() {
    AllocConsole();
    FILE* Dummy;
    freopen_s(&Dummy, "CONOUT$", "w", stdout);
    freopen_s(&Dummy, "CONIN$", "r", stdin);

    std::cout << "Welcome to Undaunted v" << UNDAUNTED_INTERNAL_VERSION << "!" << std::endl;
    std::cout << "prod. gwog :3" << std::endl;
    std::cout << "thanks to all who contributed in any way, you know who you are, dm me on discord if you want a named shoutout here :3" << std::endl;

    Globals::AmServer = std::string(GetCommandLineA()).contains("-server");

    if (Globals::AmServer) {
        std::cout << "Running as a server!" << std::endl;
    }
    else {
        std::cout << "Running as a debug-enabled client!" << std::endl;
    }

    std::thread t(MainThread);
    t.detach();
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

