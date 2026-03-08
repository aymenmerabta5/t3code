import { ChevronUpIcon, ExternalLinkIcon, LogOutIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ServerProviderAuthStatus, ServerProviderAccountType } from "@t3tools/contracts";

import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { readNativeApi } from "~/nativeApi";
import { OpenAI, ClaudeAI, CursorIcon, OpenCodeIcon, Gemini } from "./Icons";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "./ui/menu";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "./ui/sidebar";

function AuthDot({ status }: { status: ServerProviderAuthStatus | undefined }) {
  const color =
    status === "authenticated"
      ? "bg-emerald-500"
      : status === "unauthenticated"
        ? "bg-red-500"
        : "bg-amber-500";
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}

function getManageAccountUrl(accountType: ServerProviderAccountType | undefined): string {
  if (accountType === "apiKey") return "https://platform.openai.com";
  return "https://chatgpt.com/#settings";
}

const COMING_SOON_PROVIDERS = [
  { name: "Claude Code", Icon: ClaudeAI },
  { name: "Cursor", Icon: CursorIcon },
  { name: "OpenCode", Icon: OpenCodeIcon },
  { name: "Gemini", Icon: Gemini },
] as const;

export function AccountStatusWidget() {
  const { data: serverConfig } = useQuery(serverConfigQueryOptions());
  const codexProvider = serverConfig?.providers?.find((s) => s.provider === "codex");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const triggerLabel = "My Accounts";

  const handleManageAccount = () => {
    const api = readNativeApi();
    if (!api) return;
    void api.shell.openExternal(getManageAccountUrl(codexProvider?.accountType));
  };

  const handleLogout = async () => {
    const api = readNativeApi();
    if (!api || isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await api.server.logoutAccount({ provider: "codex" });
    } catch (error) {
      console.error("Failed to logout Codex account", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                size="sm"
                className="gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
              />
            }
          >
            <UserIcon className="size-4 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
            <ChevronUpIcon className="ml-auto size-3.5 shrink-0 opacity-60" />
          </MenuTrigger>

          <MenuPopup side="top" align="start" sideOffset={8} className="w-56">
            <MenuGroup>
              <MenuGroupLabel>Accounts</MenuGroupLabel>
              <MenuSub>
                <MenuSubTrigger className="gap-3">
                  <AuthDot status={codexProvider?.authStatus} />
                  <OpenAI className="size-3.5 shrink-0 text-muted-foreground/85" />
                  <span className="flex-1 truncate">Codex</span>
                  {codexProvider?.planLabel && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                      {codexProvider.planLabel}
                    </span>
                  )}
                </MenuSubTrigger>
                <MenuSubPopup className="w-52">
                  <MenuGroup>
                    <MenuItem className="gap-2" onClick={handleManageAccount}>
                      <span className="flex-1">Manage account</span>
                      <ExternalLinkIcon className="size-3.5 opacity-60" />
                    </MenuItem>
                    <MenuItem className="gap-2" disabled={isLoggingOut} onClick={() => void handleLogout()}>
                      <LogOutIcon className="size-3.5 opacity-80" />
                      <span className="flex-1">{isLoggingOut ? "Logging out..." : "Logout"}</span>
                    </MenuItem>
                    <MenuItem className="gap-2 opacity-50" disabled>
                      <span className="flex-1">Rate Limit (Coming soon)</span>
                    </MenuItem>
                  </MenuGroup>
                </MenuSubPopup>
              </MenuSub>
            </MenuGroup>

            <MenuGroup>
              <MenuGroupLabel>Coming soon</MenuGroupLabel>
              {COMING_SOON_PROVIDERS.map(({ name, Icon }) => (
                <MenuItem key={name} className="cursor-default gap-3 opacity-50" disabled>
                  <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/30" />
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{name}</span>
                </MenuItem>
              ))}
            </MenuGroup>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
