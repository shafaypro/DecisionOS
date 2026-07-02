"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/row";
import { Text } from "@/components/ui/text";

interface AccountBlockProps {
  userName: string;
  userEmail: string;
}

// Account container: the user identity row (a real Row).
export function AccountBlock({ userName, userEmail }: AccountBlockProps) {
  return (
    <div className="m-1 overflow-hidden rounded-xs border border-slate-200/70">
      <Row
        title={userName}
        subtitle={userEmail}
        leading={
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
            <Text as="span" size="xs" weight="bold" color="inverse">
              {userName.charAt(0).toUpperCase()}
            </Text>
          </div>
        }
        trailing={
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 w-7 text-slate-400 hover:text-slate-900"
              title="Log out"
              aria-label="Log out"
              icon={<LogOut className="h-4 w-4" />}
            />
          </form>
        }
      />
    </div>
  );
}
