from server.routers.auth      import router as auth_router
from server.routers.devices   import router as devices_router
from server.routers.networks  import router as networks_router
from server.routers.firewall  import router as firewall_router
from server.routers.ids       import router as ids_router
from server.routers.files     import router as files_router
from server.routers.audit     import router as audit_router
from server.routers.policies  import router as policies_router
from server.routers.dashboard import router as dashboard_router
from server.routers.vpn       import router as vpn_router
from server.routers.ws        import router as websocket_router

__all__ = [
    "auth_router", "devices_router", "networks_router", "firewall_router",
    "ids_router", "files_router", "audit_router", "policies_router",
    "dashboard_router", "vpn_router", "websocket_router",
]
