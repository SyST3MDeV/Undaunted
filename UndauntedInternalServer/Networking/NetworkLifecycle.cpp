#include "NetworkLifecycle.h"

#include <atomic>
#include <algorithm>
#include <string>

namespace Networking::Lifecycle {
    namespace {
        LifecycleConfig Config{};
        std::atomic<uint64_t> Observation{0};
        std::atomic<uint32_t> HeartbeatSequence{0};
        uint32_t ObservationSequence = 0;
        uint16_t WorldEpoch = 0;
        SDK::UWorld* ObservedWorld = nullptr;
        HANDLE Timer = nullptr;

        std::string Utf8(const std::wstring& Value) {
            if (Value.empty()) return {};
            const int Size = WideCharToMultiByte(CP_UTF8, 0, Value.c_str(), -1,
                nullptr, 0, nullptr, nullptr);
            if (Size <= 1) return {};
            std::string Result(static_cast<size_t>(Size - 1), '\0');
            WideCharToMultiByte(CP_UTF8, 0, Value.c_str(), -1, Result.data(),
                Size, nullptr, nullptr);
            return Result;
        }

        void CALLBACK Heartbeat(void*, BOOLEAN) {
            const uint64_t Packed = Observation.load(std::memory_order_acquire);
            const uint32_t Sequence = static_cast<uint32_t>(Packed >> 32);
            if (Sequence == 0 || Config.callbackUrl.empty()) return;

            uint32_t HeartbeatId = HeartbeatSequence.fetch_add(
                1, std::memory_order_relaxed) + 1;
            if (HeartbeatId == 0) {
                HeartbeatSequence.store(1, std::memory_order_relaxed);
                HeartbeatId = 1;
            }

            const uint32_t Epoch = static_cast<uint32_t>((Packed >> 16) & 0xffffu);
            const uint32_t Raw = static_cast<uint32_t>((Packed >> 8) & 0xffu);
            const uint32_t Tracked = static_cast<uint32_t>(Packed & 0xffu);
            const std::string Body = "{\"id\":\"" + Utf8(Config.serverId) +
                "\",\"port\":" + std::to_string(Config.port) +
                ",\"pid\":" + std::to_string(GetCurrentProcessId()) +
                ",\"liveConnections\":" + std::to_string(Tracked) +
                ",\"rawConnections\":" + std::to_string(Raw) +
                ",\"protocolVersion\":" + std::to_string(Config.protocolVersion) +
                ",\"heartbeatSequence\":" + std::to_string(HeartbeatId) +
                ",\"observationSequence\":" + std::to_string(Sequence) +
                ",\"worldEpoch\":" + std::to_string(Epoch) + "}";

            if (Config.callback != nullptr)
                Config.callback(Config.callbackUrl, L"x-undaunted-lifecycle-token",
                    Config.callbackToken, Body);
        }
    }

    bool Start(const LifecycleConfig& NewConfig) {
        Stop();
        Config = NewConfig;
        if (Config.callbackUrl.empty()) return false;
        return CreateTimerQueueTimer(&Timer, nullptr, Heartbeat, nullptr, 0,
            5000, WT_EXECUTEDEFAULT) != FALSE;
    }

    void Stop() {
        if (Timer != nullptr) {
            DeleteTimerQueueTimer(nullptr, Timer, INVALID_HANDLE_VALUE);
            Timer = nullptr;
        }
        Observation.store(0, std::memory_order_release);
        HeartbeatSequence.store(0, std::memory_order_release);
        ObservationSequence = 0;
        WorldEpoch = 0;
        ObservedWorld = nullptr;
    }

    void ObserveConnections(uint32_t Tracked, uint32_t Raw, SDK::UWorld* World) {
        if (ObservedWorld != World) {
            ObservedWorld = World;
            if (++WorldEpoch == 0) WorldEpoch = 1;
        }
        if (++ObservationSequence == 0) ObservationSequence = 1;
        const uint64_t Packed =
            (static_cast<uint64_t>(ObservationSequence) << 32) |
            (static_cast<uint64_t>(WorldEpoch) << 16) |
            (static_cast<uint64_t>((std::min)(Raw, 128u)) << 8) |
            static_cast<uint64_t>((std::min)(Tracked, 128u));
        Observation.store(Packed, std::memory_order_release);
    }

    void ResetWorld(SDK::UWorld* World) {
        if (ObservedWorld == World) return;
        ObservedWorld = World;
        ObservationSequence = 0;
        Observation.store(0, std::memory_order_release);
        if (++WorldEpoch == 0) WorldEpoch = 1;
    }
}
