#pragma once

#include <Windows.h>
#include "SDK.hpp"

using namespace SDK;

namespace Networking {
	extern UNetDriver* NetDriver;

	void Listen(UEngine* Engine, int Port);

	void TickNetworking();
}