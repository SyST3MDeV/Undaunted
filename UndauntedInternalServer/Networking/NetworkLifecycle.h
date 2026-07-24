#pragma once

#include <Windows.h>
#include <cstdint>
#include <string>

namespace SDK {
    class UWorld;
}

namespace Networking::Lifecycle {
    using Callback = bool(*)(const std::wstring& Url, const std::wstring& TokenHeader,
        const std::wstring& Token, const std::string& Body);

    struct LifecycleConfig {
        std::wstring callbackUrl;
        std::wstring callbackToken;
        std::wstring serverId;
        uint16_t port = 0;
        uint32_t protocolVersion = 2;
        Callback callback = nullptr;
    };

    bool Start(const LifecycleConfig& Config);
    void Stop();
    void ObserveConnections(uint32_t Tracked, uint32_t Raw, SDK::UWorld* World);
    void ResetWorld(SDK::UWorld* World);
}
